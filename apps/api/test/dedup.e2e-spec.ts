import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { DATABASE, type Database } from '../src/db/database.js';
import { DrizzleEventsRepository } from '../src/events/drizzle-events.repository.js';
import type { EventsJob } from '../src/events/events.queue.js';
import {
  EVENTS_REPOSITORY,
  type StoredEvent,
} from '../src/events/events.repository.js';
import { REDIS } from '../src/redis/redis.js';
import { dedupKey, EventsProcessor } from '../src/worker/events.processor.js';
import { createTestApp, createTestWorker } from './create-test-app.js';
import { api, drainQueue, seedIngestionKey, storedEvents } from './helpers.js';

const ORIGIN = 'https://shop.example';

const event = (clientEventId = randomUUID()) => ({
  clientEventId,
  metric: 'LCP' as const,
  value: 2100,
  path: '/products/42',
  deviceType: 'mobile' as const,
});

function failingOnce() {
  const calls: number[] = [];
  return {
    calls,
    provider: {
      inject: [DATABASE],
      factory: (db: Database) => {
        const real = new DrizzleEventsRepository(db);
        return {
          saveMany: (batch: readonly StoredEvent[]) => {
            calls.push(batch.length);
            return calls.length === 1
              ? Promise.reject(new Error('connection reset'))
              : real.saveMany(batch);
          },
        };
      },
    },
  };
}

describe('Deduplication in the worker (e2e)', () => {
  let app: NestExpressApplication;
  let worker: TestingModule | undefined;
  let key: string;

  beforeEach(async () => {
    app = await createTestApp();
    ({ key } = await seedIngestionKey(app));
  });

  afterEach(async () => {
    await Promise.all([app.close(), worker?.close()]);
    worker = undefined;
  });

  const post = (events: object[]) =>
    api(app)
      .post('/v1/events')
      .set('X-Api-Key', key)
      .set('Origin', ORIGIN)
      .send({ events })
      .expect(202);

  it('stores an event sent twice, and twice within one batch, once', async () => {
    worker = await createTestWorker();
    const repeated = event();
    const other = event();

    await post([repeated, repeated, other]);
    await post([repeated]);
    await drainQueue(app);

    const rows = await storedEvents(app);
    expect(rows.map((row) => row.clientEventId).sort()).toEqual(
      [repeated.clientEventId, other.clientEventId].sort(),
    );
  });

  it('retries a job whose INSERT failed without losing or duplicating events', async () => {
    const repository = failingOnce();
    worker = await createTestWorker((builder) =>
      builder
        .overrideProvider(EVENTS_REPOSITORY)
        .useFactory(repository.provider),
    );
    const sent = [event(), event(), event()];

    await post(sent);
    await drainQueue(app, 15_000);

    expect(repository.calls).toEqual([3, 3]);
    const rows = await storedEvents(app);
    expect(rows.map((row) => row.clientEventId).sort()).toEqual(
      sent.map((e) => e.clientEventId).sort(),
    );
  });
});

describe('EventsProcessor claims (e2e)', () => {
  let worker: TestingModule;
  let processor: EventsProcessor;
  let redis: Redis;
  let app: NestExpressApplication;
  let projectId: string;

  const job = (id: string, events: ReturnType<typeof event>[]) =>
    ({
      id,
      data: { projectId, receivedAt: new Date().toISOString(), events },
    }) as Job<EventsJob>;

  beforeEach(async () => {
    app = await createTestApp();
    ({ projectId } = await seedIngestionKey(app));
  });

  afterEach(async () => {
    await Promise.all([app.close(), worker.close()]);
  });

  it('inserts events whose key this job claimed before crashing, skips keys of other jobs', async () => {
    worker = await createTestWorker();
    processor = worker.get(EventsProcessor);
    redis = worker.get<Redis>(REDIS);
    const ownedEarlier = event();
    const claimedByOther = event();
    const fresh = event();
    await redis.set(dedupKey(projectId, ownedEarlier.clientEventId), '42');
    await redis.set(dedupKey(projectId, claimedByOther.clientEventId), '7');

    const inserted = await processor.process(
      job('42', [ownedEarlier, claimedByOther, fresh]),
    );

    expect(inserted).toBe(2);
    expect(
      (await storedEvents(app)).map((row) => row.clientEventId).sort(),
    ).toEqual([ownedEarlier.clientEventId, fresh.clientEventId].sort());
    expect(await redis.get(dedupKey(projectId, fresh.clientEventId))).toBe(
      '42',
    );
    expect(
      await redis.ttl(dedupKey(projectId, fresh.clientEventId)),
    ).toBeGreaterThan(47 * 60 * 60);
  });

  it('releases its keys when the INSERT fails', async () => {
    worker = await createTestWorker((builder) =>
      builder.overrideProvider(EVENTS_REPOSITORY).useValue({
        saveMany: () => Promise.reject(new Error('connection reset')),
      }),
    );
    processor = worker.get(EventsProcessor);
    redis = worker.get<Redis>(REDIS);
    const sent = [event(), event()];

    await expect(processor.process(job('9', sent))).rejects.toThrow(
      'connection reset',
    );

    expect(
      await redis.exists(
        ...sent.map((e) => dedupKey(projectId, e.clientEventId)),
      ),
    ).toBe(0);
  });
});
