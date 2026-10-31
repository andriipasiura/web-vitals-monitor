import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import autocannon from 'autocannon';
import { DEVICE_TYPES, EVENT_LIMITS, METRIC_NAMES } from '@rum/shared';
import { eq, sql } from 'drizzle-orm';
import { generateToken, sha256 } from '../common/crypto/tokens.js';
import { DATABASE, type Database } from '../db/database.js';
import { apiKeys, projects, users } from '../db/schema.js';
import { EventsQueue } from '../events/events.queue.js';
import { createRedis, PRODUCER_CLIENT_OPTIONS } from '../redis/redis.js';
import { ScriptsModule } from './scripts.module.js';

const LOAD_TEST_EMAIL = 'loadtest@example.com';
const ORIGIN = 'https://loadtest.example';
const DRAIN_TIMEOUT_MS = 30 * 60 * 1000;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

const pick = <T>(values: readonly T[], i: number) => values[i % values.length]!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let sequence = 0;

function batch(): string {
  const events = Array.from({ length: EVENT_LIMITS.maxEventsPerBatch }, () => {
    const i = sequence++;
    const metric = pick(METRIC_NAMES, i);
    return {
      clientEventId: randomUUID(),
      metric,
      value: metric === 'CLS' ? (i % 50) / 100 : 100 + (i % 4000),
      path: `/products/${i % 500}`,
      deviceType: pick(DEVICE_TYPES, i),
      release: '2026.10.3',
      attribution: { target: 'main > img.hero' },
    };
  });
  return JSON.stringify({ events });
}

async function seedKey(
  db: Database,
): Promise<{ projectId: string; key: string }> {
  await db.delete(users).where(eq(users.email, LOAD_TEST_EMAIL));
  const [owner] = await db
    .insert(users)
    .values({ email: LOAD_TEST_EMAIL, passwordHash: 'not-a-login-account' })
    .returning({ id: users.id });
  const [project] = await db
    .insert(projects)
    .values({ ownerId: owner!.id, name: 'Load test', allowedOrigins: [ORIGIN] })
    .returning({ id: projects.id });
  const key = generateToken('pk_');
  await db.insert(apiKeys).values({
    projectId: project!.id,
    keyHash: sha256(key),
    prefix: key.slice(0, 11),
  });
  return { projectId: project!.id, key };
}

async function slowInserts(db: Database, ms: number): Promise<void> {
  await db.execute(
    sql.raw(`
      create or replace function loadtest_slow_insert() returns trigger
      language plpgsql as $$ begin perform pg_sleep(${ms / 1000}); return null; end $$;
      drop trigger if exists loadtest_slow_insert on events;
      create trigger loadtest_slow_insert before insert on events
        for each statement execute function loadtest_slow_insert();
    `),
  );
}

async function restoreInserts(db: Database): Promise<void> {
  await db.execute(
    sql.raw(`
      drop trigger if exists loadtest_slow_insert on events;
      drop function if exists loadtest_slow_insert();
    `),
  );
}

async function queueDepth(queue: EventsQueue): Promise<number> {
  const counts = await queue.queue.getJobCounts(
    'waiting',
    'active',
    'delayed',
    'prioritized',
  );
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

async function main(): Promise<void> {
  const label = argument('label') ?? 'run';
  const url = argument('url') ?? 'http://localhost:3001';
  const connections = Number(argument('connections') ?? 50);
  const duration = Number(argument('duration') ?? 30);
  const slowInsertMs = Number(argument('slow-insert-ms') ?? 0);
  const withQueue = !process.argv.includes('--no-queue');

  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: ['error', 'warn'],
  });
  const redisUrl = app.get(ConfigService).get<string>('REDIS_URL');
  const queue =
    withQueue && redisUrl
      ? new EventsQueue(
          createRedis(redisUrl, PRODUCER_CLIENT_OPTIONS, 'loadtest'),
        )
      : undefined;
  const db = app.get<Database>(DATABASE);
  try {
    const { projectId, key } = await seedKey(db);
    if (slowInsertMs > 0) await slowInserts(db, slowInsertMs);

    let peakDepth = 0;
    const sampler = queue
      ? setInterval(() => {
          queueDepth(queue)
            .then((depth) => (peakDepth = Math.max(peakDepth, depth)))
            .catch(() => undefined);
        }, 1000)
      : undefined;

    let result: autocannon.Result;
    try {
      result = await autocannon({
        url,
        connections,
        duration,
        requests: [
          {
            method: 'POST',
            path: '/v1/events',
            headers: {
              'content-type': 'application/json',
              'x-api-key': key,
              origin: ORIGIN,
            },
            setupRequest: (req) => ({ ...req, body: batch() }),
          },
        ],
      });
    } finally {
      clearInterval(sampler);
      if (slowInsertMs > 0) await restoreInserts(db);
    }

    const count = async () => {
      const { rows } = await db.execute<{ count: string }>(
        sql`select count(*) as count from events where project_id = ${projectId}`,
      );
      return Number(rows[0]!.count);
    };
    const storedAtEnd = await count();

    let queueLine = 'No queue.';
    if (queue) {
      const depthAtEnd = await queueDepth(queue);
      peakDepth = Math.max(peakDepth, depthAtEnd);
      const drainStart = Date.now();
      while ((await queueDepth(queue)) > 0) {
        if (Date.now() - drainStart > DRAIN_TIMEOUT_MS) {
          throw new Error('Queue did not drain');
        }
        await sleep(250);
      }
      const drainSeconds = (Date.now() - drainStart) / 1000;
      queueLine =
        `Queue depth: peak ${peakDepth} jobs (sampled every second), ${depthAtEnd} when the run ended, ` +
        `drained ${drainSeconds.toFixed(1)} s later` +
        (slowInsertMs > 0 ? ' (after the slowdown was removed).' : '.');
    }

    const accepted = result.statusCodeStats?.['202']?.count ?? 0;
    const statusCodes = Object.entries(result.statusCodeStats ?? {})
      .map(([code, { count = 0 }]) => `${code} × ${count}`)
      .join(', ');
    const lines = [
      `## ${label}`,
      '',
      `Finished at ${new Date().toISOString()}. ${connections} connections for ${duration} s, ${EVENT_LIMITS.maxEventsPerBatch} events per request` +
        (slowInsertMs > 0
          ? `, every INSERT into events slowed by ${slowInsertMs} ms (statement trigger).`
          : '.'),
      '',
      '| req/s | p50 ms | p99 ms | max ms | errors | timeouts |',
      '|---|---|---|---|---|---|',
      `| ${Math.round(result.requests.average)} | ${result.latency.p50} | ${result.latency.p99} | ${result.latency.max} | ${result.errors} | ${result.timeouts} |`,
      '',
      `Status codes: ${statusCodes || 'none'}. Events stored when the run ended: ${storedAtEnd}.`,
      queueLine,
      `Events stored at the end: ${await count()} (accepted requests × ${EVENT_LIMITS.maxEventsPerBatch} = ${accepted * EVENT_LIMITS.maxEventsPerBatch}; requests in flight when autocannon stopped are stored but not counted).`,
      '',
    ];

    console.log(autocannon.printResult(result));
    const out = resolve(process.cwd(), '../../docs/perf/raw/phase4.md');
    mkdirSync(dirname(out), { recursive: true });
    if (!existsSync(out)) {
      writeFileSync(out, '# Perf runs: Phase 4 ingestion\n\n');
    }
    appendFileSync(out, lines.join('\n'));
    console.log(lines.join('\n'));
  } finally {
    await queue?.close();
    await app.close();
  }
}

await main();
