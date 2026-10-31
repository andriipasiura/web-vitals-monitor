import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DATABASE, type Database } from '../src/db/database.js';
import { DrizzleEventsRepository } from '../src/events/drizzle-events.repository.js';
import { EventsQueue } from '../src/events/events.queue.js';
import {
  EVENTS_REPOSITORY,
  type StoredEvent,
} from '../src/events/events.repository.js';
import { createTestApp, createTestWorker } from './create-test-app.js';
import { api, seedIngestionKey, sleep, storedEvents } from './helpers.js';

const INSERT_DELAY_MS = 500;

describe('Worker graceful shutdown (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('finishes an active job before close resolves', async () => {
    let started = false;
    const worker = await createTestWorker((builder) =>
      builder.overrideProvider(EVENTS_REPOSITORY).useFactory({
        inject: [DATABASE],
        factory: (db: Database) => {
          const real = new DrizzleEventsRepository(db);
          return {
            saveMany: async (batch: readonly StoredEvent[]) => {
              started = true;
              await sleep(INSERT_DELAY_MS);
              await real.saveMany(batch);
            },
          };
        },
      }),
    );
    const { key } = await seedIngestionKey(app);

    await api(app)
      .post('/v1/events')
      .set('X-Api-Key', key)
      .set('Origin', 'https://shop.example')
      .send({
        events: [
          {
            clientEventId: randomUUID(),
            metric: 'LCP',
            value: 2100,
            path: '/a',
            deviceType: 'mobile',
          },
        ],
      })
      .expect(202);
    for (let i = 0; i < 100 && !started; i++) await sleep(10);
    expect(started).toBe(true);

    const closing = Date.now();
    await worker.close();

    expect(Date.now() - closing).toBeGreaterThanOrEqual(INSERT_DELAY_MS / 2);
    expect(await storedEvents(app)).toHaveLength(1);
    const counts = await app
      .get(EventsQueue)
      .queue.getJobCounts('waiting', 'active', 'failed');
    expect(counts).toEqual({ waiting: 0, active: 0, failed: 0 });
  });
});
