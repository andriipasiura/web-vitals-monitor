import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  bucketCount,
  bucketIndex,
  METRIC_BUCKET_BOUNDARIES,
  METRIC_NAMES,
  METRIC_THRESHOLDS,
  type MetricName,
  rateMetric,
} from '@rum/shared';
import { asc } from 'drizzle-orm';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { ADVISORY_LOCKS } from '../src/db/advisory-lock.js';
import { eventRollupsHourly, events } from '../src/db/schema.js';
import { startOfUtcDay } from '../src/events/partitions.service.js';
import { RollupsService } from '../src/rollups/rollups.service.js';
import { createTestApp } from './create-test-app.js';
import { createProject, database, signUp } from './helpers.js';

const HOUR_MS = 60 * 60 * 1000;

function histogram(metric: MetricName, values: number[]): number[] {
  const buckets = new Array<number>(bucketCount(metric)).fill(0);
  for (const value of values) buckets[bucketIndex(metric, value) - 1]! += 1;
  return buckets;
}

describe('Hourly rollups (e2e)', () => {
  let app: NestExpressApplication;
  let rollups: RollupsService;
  let projectId: string;
  const hour = new Date(startOfUtcDay(new Date()).getTime() + 5 * HOUR_MS);
  const at = (offsetHours: number, minutes = 0) =>
    new Date(hour.getTime() + offsetHours * HOUR_MS + minutes * 60_000);

  async function insert(
    rows: {
      metric?: MetricName;
      value: number;
      receivedAt?: Date;
      release?: string | null;
      route?: string;
    }[],
  ): Promise<void> {
    await database(app)
      .insert(events)
      .values(
        rows.map(({ metric = 'LCP', value, receivedAt, release, route }) => ({
          projectId,
          metric,
          value,
          rating: rateMetric(metric, value),
          path: route ?? '/a',
          route: route ?? '/a',
          routeSource: 'server',
          deviceType: 'mobile',
          release: release ?? null,
          clientEventId: randomUUID(),
          receivedAt: receivedAt ?? at(0, 10),
        })),
      );
  }

  const stored = () =>
    database(app)
      .select()
      .from(eventRollupsHourly)
      .orderBy(
        asc(eventRollupsHourly.hour),
        asc(eventRollupsHourly.metric),
        asc(eventRollupsHourly.release),
      );

  beforeAll(async () => {
    app = await createTestApp();
    rollups = app.get(RollupsService);
  });

  beforeEach(async () => {
    const { accessToken } = await signUp(app);
    ({ id: projectId } = await createProject(app, accessToken));
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores exact counts, ratings, sums and buckets', async () => {
    const values = [100, 100.5, 2500, 2500.01, 4000, 70000];
    await insert(values.map((value) => ({ value })));

    expect(await rollups.recompute(at(0), at(1))).toBe(1);

    const [row] = await stored();
    expect(row).toEqual({
      projectId,
      metric: 'LCP',
      route: '/a',
      deviceType: 'mobile',
      release: null,
      hour,
      count: 6,
      goodCount: 3,
      niCount: 2,
      poorCount: 1,
      sumValue: expect.closeTo(
        values.reduce((sum, value) => sum + value, 0),
        6,
      ),
      buckets: histogram('LCP', values),
    });
    const goodBuckets = row!.buckets.slice(
      0,
      bucketIndex('LCP', METRIC_THRESHOLDS.LCP.good),
    );
    expect(goodBuckets.reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('puts values on every edge in the same bucket as bucketIndex', async () => {
    const valuesFor = (metric: MetricName) =>
      [0, ...METRIC_BUCKET_BOUNDARIES[metric]].flatMap((edge) => [
        edge,
        edge + 1e-6,
      ]);
    await insert(
      METRIC_NAMES.flatMap((metric) =>
        valuesFor(metric).map((value) => ({ metric, value })),
      ),
    );

    await rollups.recompute(at(0), at(1));

    const rows = await stored();
    expect(rows).toHaveLength(METRIC_NAMES.length);
    for (const row of rows) {
      const metric = row.metric as MetricName;
      expect(row.buckets).toEqual(histogram(metric, valuesFor(metric)));
    }
  });

  it('is idempotent and absorbs late events', async () => {
    await insert([{ value: 1000 }, { value: 3000 }]);
    await rollups.recompute(at(0), at(1));
    const first = await stored();

    await rollups.recompute(at(0), at(1));
    expect(await stored()).toEqual(first);

    await insert([{ value: 5000, receivedAt: at(0, 59) }]);
    await rollups.recompute(at(0), at(1));
    expect(await stored()).toMatchObject([
      { count: 3, goodCount: 1, niCount: 1, poorCount: 1 },
    ]);
  });

  it('keeps one row per release, including no release', async () => {
    await insert([
      { value: 1000 },
      { value: 1000, release: '1.0.0' },
      { value: 2000 },
    ]);

    await rollups.recompute(at(0), at(1));
    await rollups.recompute(at(0), at(1));

    expect(await stored()).toMatchObject([
      { release: '1.0.0', count: 1 },
      { release: null, count: 2 },
    ]);
  });

  it('recomputes only the current hour and the two before it', async () => {
    await insert(
      [-3, -2, -1, 0].map((offset) => ({
        value: 1000,
        receivedAt: at(offset, 30),
      })),
    );

    expect(await rollups.recomputeRecent(at(0, 45))).toEqual({
      acquired: true,
      result: 3,
    });

    expect((await stored()).map((row) => row.hour)).toEqual([
      at(-2),
      at(-1),
      at(0),
    ]);
  });

  it('skips when another session holds the lock', async () => {
    await insert([{ value: 1000 }]);
    const pool = new Pool({ connectionString: inject('databaseUrl') });
    const client = await pool.connect();
    try {
      await client.query('select pg_advisory_lock($1)', [
        ADVISORY_LOCKS.rollups,
      ]);

      expect(await rollups.recomputeRecent(at(0, 45))).toEqual({
        acquired: false,
      });
      expect(await stored()).toEqual([]);
    } finally {
      await client.query('select pg_advisory_unlock_all()');
      client.release();
      await pool.end();
    }
  });
});
