import { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { ADVISORY_LOCKS } from '../src/db/advisory-lock.js';
import {
  createPartition,
  partitionName,
  PartitionsService,
  startOfUtcDay,
} from '../src/events/partitions.service.js';
import { createTestApp } from './create-test-app.js';
import { database } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Partition maintenance (e2e)', () => {
  let app: NestExpressApplication;
  let service: PartitionsService;
  const today = startOfUtcDay(new Date());
  const day = (offset: number) => new Date(today.getTime() + offset * DAY_MS);

  async function partitions(): Promise<string[]> {
    const { rows } = await database(app).execute<{ name: string }>(sql`
      select c.relname as name from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      where i.inhparent = 'events'::regclass
      order by 1
    `);
    return rows.map((row) => row.name);
  }

  async function dropIfExists(offset: number): Promise<void> {
    await database(app).execute(
      sql.raw(`drop table if exists "${partitionName(day(offset))}"`),
    );
  }

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(PartitionsService);
  });

  afterEach(async () => {
    for (const offset of [-40, -31, -30, -10, 8, 9, 10]) {
      await dropIfExists(offset);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates partitions for today and 7 days ahead on startup', async () => {
    const names = await partitions();
    for (let offset = 0; offset <= 7; offset++) {
      expect(names).toContain(partitionName(day(offset)));
    }
    expect(names).not.toContain(partitionName(day(8)));
  });

  it('creates missing days as time moves on and is idempotent', async () => {
    const later = day(3);

    expect(await service.maintain(later)).toEqual({
      acquired: true,
      result: {
        created: [8, 9, 10].map((offset) => partitionName(day(offset))),
        dropped: [],
      },
    });
    expect(await service.maintain(later)).toEqual({
      acquired: true,
      result: { created: [], dropped: [] },
    });
  });

  it('drops partitions whose whole range is older than 30 days', async () => {
    const db = database(app);
    for (const offset of [-40, -31, -30, -10]) {
      await createPartition(db, day(offset));
    }

    const outcome = await service.maintain();

    expect(outcome).toEqual({
      acquired: true,
      result: {
        created: [],
        dropped: [-40, -31].map((offset) => partitionName(day(offset))),
      },
    });
    const names = await partitions();
    expect(names).toContain(partitionName(day(-30)));
    expect(names).toContain(partitionName(day(-10)));
  });

  it('skips when another session holds the lock', async () => {
    const pool = new Pool({ connectionString: inject('databaseUrl') });
    const client = await pool.connect();
    try {
      await client.query('select pg_advisory_lock($1)', [
        ADVISORY_LOCKS.partitions,
      ]);

      expect(await service.maintain(day(3))).toEqual({ acquired: false });
      expect(await partitions()).not.toContain(partitionName(day(8)));
    } finally {
      await client.query('select pg_advisory_unlock_all()');
      client.release();
      await pool.end();
    }
  });

  it('rejects events outside every partition', async () => {
    await expect(
      database(app).execute(sql`
        insert into events (project_id, metric, value, rating, path, route,
          route_source, device_type, client_event_id, received_at)
        values (gen_random_uuid(), 'LCP', 1, 'good', '/', '/', 'server',
          'mobile', gen_random_uuid(), ${day(-100).toISOString()})
      `),
    ).rejects.toThrow();
  });
});
