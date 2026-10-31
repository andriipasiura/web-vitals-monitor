import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';
import * as schema from '../src/db/schema.js';
import {
  createPartition,
  PARTITION_DAYS_AHEAD,
  startOfUtcDay,
} from '../src/events/partitions.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

let postgres: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);
  const databaseUrl = postgres.getConnectionUri();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
    const today = startOfUtcDay(new Date());
    for (let offset = 0; offset <= PARTITION_DAYS_AHEAD; offset++) {
      await createPartition(db, new Date(today.getTime() + offset * DAY_MS));
    }
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('redisUrl', redis.getConnectionUrl());
}

export async function teardown(): Promise<void> {
  await Promise.all([postgres?.stop(), redis?.stop()]);
}
