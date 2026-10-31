import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { rateMetric } from '@rum/shared';
import { Redis } from 'ioredis';
import { events } from '../src/db/schema.js';
import { startOfUtcDay } from '../src/events/partitions.service.js';
import { REDIS } from '../src/redis/redis.js';
import { RollupsService } from '../src/rollups/rollups.service.js';
import { createTestApp } from './create-test-app.js';
import { api, createProject, database, deadRedis, signUp } from './helpers.js';

const HOUR_MS = 60 * 60 * 1000;

describe('Query cache (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;
  let projectId: string;
  const hour = new Date(startOfUtcDay(new Date()).getTime() + 5 * HOUR_MS);
  const period = {
    from: new Date(hour.getTime() - HOUR_MS).toISOString(),
    to: new Date(hour.getTime() + 2 * HOUR_MS).toISOString(),
  };

  const get = (
    target: NestExpressApplication,
    path: string,
    query: Record<string, string>,
  ) =>
    api(target)
      .get(`/v1/projects/${projectId}${path}`)
      .auth(token, { type: 'bearer' })
      .query(query)
      .expect(200);

  beforeEach(async () => {
    app = await createTestApp();
    ({ accessToken: token } = await signUp(app));
    ({ id: projectId } = await createProject(app, token));
    await database(app)
      .insert(events)
      .values(
        [1000, 2000, 3000, 4500].map((value, i) => ({
          projectId,
          metric: 'LCP',
          value,
          rating: rateMetric('LCP', value),
          path: i % 2 ? '/a' : '/b',
          route: i % 2 ? '/a' : '/b',
          routeSource: 'server' as const,
          deviceType: 'mobile' as const,
          clientEventId: randomUUID(),
          receivedAt: new Date(hour.getTime() + 10 * 60_000),
        })),
      );
    await new RollupsService(database(app)).recompute(
      hour,
      new Date(hour.getTime() + HOUR_MS),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it.each([
    ['/metrics', { metric: 'LCP', ...period }],
    ['/routes', { metric: 'LCP', ...period }],
  ])('serves a repeated %s query from the cache', async (path, query) => {
    const execute = vi.spyOn(database(app), 'execute');

    const first = await get(app, path, query);
    expect(execute).toHaveBeenCalledTimes(1);

    const second = await get(app, path, {
      percentile: 'p75',
      to: query.to,
      from: query.from,
      metric: 'LCP',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);
  });

  it('stores entries for 60 s ± 10 %', async () => {
    await get(app, '/metrics', { metric: 'LCP', ...period });

    const redis = app.get<Redis>(REDIS);
    const [key] = await redis.keys('cache:metrics:*');
    const ttl = await redis.ttl(key!);
    expect(ttl).toBeGreaterThanOrEqual(53);
    expect(ttl).toBeLessThanOrEqual(66);
  });

  it('runs one Postgres query for concurrent misses', async () => {
    const execute = vi.spyOn(database(app), 'execute');

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        get(app, '/metrics', { metric: 'LCP', ...period }),
      ),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    for (const res of responses) expect(res.body).toEqual(responses[0]!.body);
  });

  it('does not serve another owner a cached result', async () => {
    await get(app, '/metrics', { metric: 'LCP', ...period });
    const { accessToken: other } = await signUp(app, 'other@example.com');

    await api(app)
      .get(`/v1/projects/${projectId}/metrics`)
      .auth(other, { type: 'bearer' })
      .query({ metric: 'LCP', ...period })
      .expect(404);
  });

  it('returns the same results from Postgres when Redis is down', async () => {
    const down = await createTestApp((builder) =>
      builder.overrideProvider(REDIS).useValue(deadRedis()),
    );
    try {
      for (const path of ['/metrics', '/routes']) {
        const query = { metric: 'LCP', ...period };
        const expected = await get(app, path, query);
        const execute = vi.spyOn(database(down), 'execute');

        const first = await get(down, path, query);
        const second = await get(down, path, query);

        expect(first.body).toEqual(expected.body);
        expect(second.body).toEqual(expected.body);
        expect(execute).toHaveBeenCalledTimes(2);
        execute.mockRestore();
      }
    } finally {
      await down.close();
    }
  });
});
