import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { ApiKeysService } from '../src/api-keys/api-keys.service.js';
import { EventsQueue } from '../src/events/events.queue.js';
import { REDIS } from '../src/redis/redis.js';
import {
  RATE_LIMITS,
  RateLimitService,
} from '../src/rate-limit/rate-limit.service.js';
import { createTestApp } from './create-test-app.js';
import {
  api,
  createApiKey,
  createProject,
  deadRedis,
  errorOf,
  PASSWORD,
  seedIngestionKey,
  signUp,
  storedEvents,
} from './helpers.js';

const ORIGIN = 'https://shop.example';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const batch = () => ({
  events: [
    {
      clientEventId: randomUUID(),
      metric: 'LCP',
      value: 2100,
      path: '/products/42',
      deviceType: 'mobile',
    },
  ],
});

function expectRateLimited(res: request.Response, limit: number): void {
  expect(res.status).toBe(429);
  expect(errorOf(res)).toMatchObject({
    code: 'RATE_LIMITED',
    requestId: res.headers['x-request-id'],
  });
  expect(res.headers['ratelimit-limit']).toBe(String(limit));
  expect(res.headers['ratelimit-remaining']).toBe('0');
  expect(Number(res.headers['ratelimit-reset'])).toBeGreaterThan(0);
  expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
}

async function setUpKey(app: NestExpressApplication) {
  const { accessToken } = await signUp(app);
  const project = await createProject(app, accessToken);
  return createApiKey(app, accessToken, project.id);
}

describe('Ingestion rate limits (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('limits a client IP to a burst of 20, before the key lookup, then refills', async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        api(app)
          .post('/v1/events')
          .set('Origin', ORIGIN)
          .set('X-Api-Key', 'pk_unknown')
          .send(batch()),
      ),
    );
    const limited = responses.filter((res) => res.status === 429);
    const rejectedKeys = responses.filter((res) => res.status === 401);

    expect(rejectedKeys.length).toBeGreaterThanOrEqual(20);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.length + rejectedKeys.length).toBe(30);
    expectRateLimited(limited[0]!, RATE_LIMITS.ingestionIp.capacity);

    await sleep(Number(limited[0]!.headers['retry-after']) * 1000);
    const { key } = await setUpKey(app);
    await api(app)
      .post('/v1/events')
      .set('Origin', ORIGIN)
      .set('X-Api-Key', key)
      .send(batch())
      .expect(202);
  });

  it('limits an ingestion key to a burst of 100', async () => {
    const { key } = await setUpKey(app);
    const { apiKeyId } = (await app.get(ApiKeysService).findProject(key))!;
    const rateLimits = app.get(RateLimitService);
    for (let i = 0; i < RATE_LIMITS.ingestionKey.capacity; i++) {
      await rateLimits.consume(RATE_LIMITS.ingestionKey, apiKeyId);
    }

    const res = await api(app)
      .post('/v1/events')
      .set('Origin', ORIGIN)
      .set('X-Api-Key', key)
      .send(batch());

    expectRateLimited(res, RATE_LIMITS.ingestionKey.capacity);
    expect(await storedEvents(app)).toHaveLength(0);
  });

  it('reports the limit closest to running out on accepted requests', async () => {
    const { key } = await setUpKey(app);

    const res = await api(app)
      .post('/v1/events')
      .set('Origin', ORIGIN)
      .set('X-Api-Key', key)
      .send(batch())
      .expect(202);

    expect(res.headers['ratelimit-limit']).toBe('20');
    expect(res.headers['ratelimit-remaining']).toBe('19');
    expect(res.headers['retry-after']).toBeUndefined();
  });
});

describe('Login rate limit (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await api(app)
      .post('/v1/auth/register')
      .send({ email: 'dev@example.com', password: PASSWORD })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  const attempt = (email: string, password = 'wrong-password') =>
    api(app).post('/v1/auth/login').send({ email, password });

  it('blocks the 6th attempt for an IP and email, even with the right password', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await attempt('dev@example.com')).status).toBe(401);
    }

    const blocked = await attempt(' DEV@example.com ', PASSWORD);

    expectRateLimited(blocked, RATE_LIMITS.login.capacity);
    expect(Number(blocked.headers['retry-after'])).toBe(180);
  });

  it('keeps separate buckets per email', async () => {
    for (let i = 0; i < 5; i++) await attempt('other@example.com');

    await attempt('dev@example.com', PASSWORD).expect(200);
  });
});

describe('Rate limits when Redis is down (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(REDIS)
        .useValue(deadRedis())
        .overrideProvider(EventsQueue)
        .useValue(new EventsQueue(deadRedis())),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails open on ingestion', async () => {
    const { key, projectId } = await seedIngestionKey(app);

    const res = await api(app)
      .post('/v1/events')
      .set('Origin', ORIGIN)
      .set('X-Api-Key', key)
      .send(batch())
      .expect(202);

    expect(res.headers['ratelimit-limit']).toBeUndefined();
    expect(await storedEvents(app)).toMatchObject([{ projectId }]);
  });

  it('fails closed on login with 503', async () => {
    await api(app)
      .post('/v1/auth/register')
      .send({ email: 'dev@example.com', password: PASSWORD })
      .expect(201);

    const res = await api(app)
      .post('/v1/auth/login')
      .send({ email: 'dev@example.com', password: PASSWORD });

    expect(res.status).toBe(503);
    expect(errorOf(res).code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
