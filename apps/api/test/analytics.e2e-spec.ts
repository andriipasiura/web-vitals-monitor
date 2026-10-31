import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import {
  bucketCount,
  bucketIndex,
  type DeviceType,
  type MetricName,
  percentileFromHistogram,
  rateMetric,
} from '@rum/shared';
import { sql } from 'drizzle-orm';
import { events } from '../src/db/schema.js';
import {
  createPartition,
  partitionName,
  startOfUtcDay,
} from '../src/events/partitions.service.js';
import { RollupsService } from '../src/rollups/rollups.service.js';
import { createTestApp } from './create-test-app.js';
import { api, createProject, database, errorOf, signUp } from './helpers.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface EventRow {
  metric?: MetricName;
  value: number;
  route?: string;
  path?: string;
  deviceType?: DeviceType;
  receivedAt?: Date;
  attribution?: Record<string, string>;
}

interface ResponseBody {
  summary: { count: number };
  series: unknown[];
  routes: { route: string }[];
  paths: { path: string; value: number }[];
  nextCursor: string | null;
}

const body = (res: request.Response) => res.body as ResponseBody;

describe('Analytics (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;
  let projectId: string;
  const today = startOfUtcDay(new Date());
  const hour = new Date(today.getTime() + 5 * HOUR_MS);
  const at = (offsetHours: number) =>
    new Date(hour.getTime() + offsetHours * HOUR_MS + 10 * 60_000);

  async function insert(rows: EventRow[]): Promise<void> {
    await database(app)
      .insert(events)
      .values(
        rows.map((row) => {
          const metric = row.metric ?? 'LCP';
          const route = row.route ?? '/a';
          return {
            projectId,
            metric,
            value: row.value,
            rating: rateMetric(metric, row.value),
            path: row.path ?? route,
            route,
            routeSource: 'server',
            deviceType: row.deviceType ?? 'mobile',
            attribution: row.attribution,
            clientEventId: randomUUID(),
            receivedAt: row.receivedAt ?? at(0),
          };
        }),
      );
  }

  const get = (path: string, query: Record<string, string | number> = {}) =>
    api(app)
      .get(`/v1/projects/${projectId}${path}`)
      .auth(token, { type: 'bearer' })
      .query(query);

  const period = {
    from: hour.toISOString(),
    to: new Date(hour.getTime() + 2 * HOUR_MS).toISOString(),
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    ({ accessToken: token } = await signUp(app));
    ({ id: projectId } = await createProject(app, token));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access and validation', () => {
    it.each([
      ['/metrics', { metric: 'LCP', ...period }],
      ['/routes', { metric: 'LCP', ...period }],
      ['/routes/paths', { metric: 'LCP', route: '/a' }],
      ['/routes/attribution', { route: '/a' }],
    ])('returns 404 for another user’s project on %s', async (path, query) => {
      const { accessToken: other } = await signUp(app, 'other@example.com');

      const res = await api(app)
        .get(`/v1/projects/${projectId}${path}`)
        .auth(other, { type: 'bearer' })
        .query(query)
        .expect(404);

      expect(errorOf(res).code).toBe('PROJECT_NOT_FOUND');
    });

    it('requires authentication', async () => {
      await api(app)
        .get(`/v1/projects/${projectId}/metrics`)
        .query({ metric: 'LCP', ...period })
        .expect(401);
    });

    it('rejects invalid query parameters with field details', async () => {
      const res = await get('/metrics', { ...period, percentile: 'p42' });

      expect(res.status).toBe(400);
      expect(errorOf(res).details).toEqual([
        expect.objectContaining({ path: 'metric' }),
        expect.objectContaining({ path: 'percentile' }),
      ]);
    });

    it('rejects a malformed cursor', async () => {
      const res = await get('/routes/paths', {
        metric: 'LCP',
        route: '/a',
        cursor: 'not-a-cursor',
      });

      expect(res.status).toBe(400);
      expect(errorOf(res).code).toBe('INVALID_CURSOR');
    });
  });

  describe('GET /metrics', () => {
    beforeEach(async () => {
      await insert([
        ...[1000, 2000, 3000, 4000].map((value) => ({ value })),
        { value: 500, route: '/b', deviceType: 'desktop', receivedAt: at(1) },
      ]);
      await new RollupsService(database(app)).recompute(hour, at(2));
    });

    it('returns an hourly percentile series with rating shares', async () => {
      const res = await get('/metrics', {
        metric: 'LCP',
        ...period,
        percentile: 'p50',
      }).expect(200);

      expect(res.body).toEqual({
        metric: 'LCP',
        percentile: 'p50',
        granularity: 'hour',
        summary: {
          value: 1950,
          count: 5,
          shares: { good: 0.6, needsImprovement: 0.4, poor: 0 },
        },
        series: [
          {
            time: hour.toISOString(),
            value: 2000,
            count: 4,
            shares: { good: 0.5, needsImprovement: 0.5, poor: 0 },
          },
          {
            time: new Date(hour.getTime() + HOUR_MS).toISOString(),
            value: 450,
            count: 1,
            shares: { good: 1, needsImprovement: 0, poor: 0 },
          },
        ],
      });
    });

    it('sums histograms into UTC days instead of averaging percentiles', async () => {
      const res = await get('/metrics', {
        metric: 'LCP',
        ...period,
        granularity: 'day',
      }).expect(200);

      const buckets = new Array<number>(bucketCount('LCP')).fill(0);
      for (const value of [1000, 2000, 3000, 4000, 500]) {
        buckets[bucketIndex('LCP', value) - 1]! += 1;
      }
      expect(body(res).series).toEqual([
        {
          time: today.toISOString(),
          value: percentileFromHistogram('LCP', buckets, 0.75),
          count: 5,
          shares: { good: 0.6, needsImprovement: 0.4, poor: 0 },
        },
      ]);
    });

    it('applies route and device filters', async () => {
      const byRoute = await get('/metrics', {
        metric: 'LCP',
        ...period,
        route: '/b',
      }).expect(200);
      const byDevice = await get('/metrics', {
        metric: 'LCP',
        ...period,
        device_type: 'mobile',
      }).expect(200);

      expect(body(byRoute).summary.count).toBe(1);
      expect(body(byDevice).summary.count).toBe(4);
    });

    it('returns an empty series for another metric', async () => {
      const res = await get('/metrics', { metric: 'CLS', ...period }).expect(
        200,
      );

      expect(body(res).summary).toEqual({
        value: null,
        count: 0,
        shares: null,
      });
      expect(body(res).series).toEqual([]);
    });
  });

  describe('GET /routes', () => {
    it('summarizes routes sorted by the chosen percentile', async () => {
      await insert([
        { value: 500, route: '/fast' },
        ...[3000, 5000].map((value) => ({ value, route: '/slow' })),
      ]);
      await new RollupsService(database(app)).recompute(hour, at(1));

      const res = await get('/routes', { metric: 'LCP', ...period }).expect(
        200,
      );
      const limited = await get('/routes', {
        metric: 'LCP',
        ...period,
        limit: 1,
      }).expect(200);

      expect(body(res).routes).toEqual([
        {
          route: '/slow',
          value: 4950,
          count: 2,
          shares: { good: 0, needsImprovement: 0.5, poor: 0.5 },
        },
        {
          route: '/fast',
          value: 475,
          count: 1,
          shares: { good: 1, needsImprovement: 0, poor: 0 },
        },
      ]);
      expect(body(limited).routes.map((r) => r.route)).toEqual(['/slow']);
    });
  });

  describe('GET /routes/paths', () => {
    const oldDay = new Date(today.getTime() - 8 * DAY_MS);

    afterEach(async () => {
      await database(app).execute(
        sql.raw(`drop table if exists "${partitionName(oldDay)}"`),
      );
    });

    it('pages through the slowest paths of a route from raw events', async () => {
      await createPartition(database(app), oldDay);
      const route = '/p/:id';
      await insert([
        { route, path: '/p/1', value: 100 },
        { route, path: '/p/1', value: 200 },
        { route, path: '/p/2', value: 300 },
        { route, path: '/p/3', value: 300 },
        { route, path: '/p/4', value: 50 },
        { route: '/other', path: '/other', value: 9000 },
        {
          route,
          path: '/p/9',
          value: 9999,
          receivedAt: new Date(oldDay.getTime() + HOUR_MS),
        },
      ]);
      const query = { metric: 'LCP', route, percentile: 'p50', limit: 2 };

      const first = await get('/routes/paths', query).expect(200);
      const second = await get('/routes/paths', {
        ...query,
        cursor: body(first).nextCursor!,
      }).expect(200);

      const pathsOf = ({ paths }: ResponseBody) =>
        paths.map(({ path, value }) => [path, value]);
      expect(pathsOf(body(first))).toEqual([
        ['/p/2', 300],
        ['/p/3', 300],
      ]);
      expect(body(first).nextCursor).toEqual(expect.any(String));
      expect(pathsOf(body(second))).toEqual([
        ['/p/1', 150],
        ['/p/4', 50],
      ]);
      expect(body(second).nextCursor).toBeNull();
      expect(body(second).paths[0]).toEqual({
        path: '/p/1',
        value: 150,
        count: 2,
        shares: { good: 1, needsImprovement: 0, poor: 0 },
      });
    });
  });

  describe('GET /routes/attribution', () => {
    it('returns top LCP elements and slowest INP targets', async () => {
      await insert([
        ...[1000, 2000, 3000].map((value) => ({
          value,
          attribution: { target: 'img.hero' },
        })),
        { value: 800, attribution: { target: 'h1' } },
        { value: 900 },
        ...[100, 200, 300, 400, 500].map((value) => ({
          metric: 'INP' as const,
          value,
          attribution: { interactionTarget: 'button.buy' },
        })),
        ...[900, 900, 900, 900].map((value) => ({
          metric: 'INP' as const,
          value,
          attribution: { interactionTarget: 'a.rare' },
        })),
      ]);

      const res = await get('/routes/attribution', { route: '/a' }).expect(200);

      expect(res.body).toEqual({
        route: '/a',
        lcpElements: [
          { metric: 'LCP', target: 'img.hero', count: 3, p75: 2500 },
          { metric: 'LCP', target: 'h1', count: 1, p75: 800 },
        ],
        inpTargets: [
          { metric: 'INP', target: 'button.buy', count: 5, p75: 400 },
        ],
      });
    });
  });
});
