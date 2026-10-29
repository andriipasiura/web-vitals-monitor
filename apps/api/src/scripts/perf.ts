import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { Pool } from 'pg';
import { rateMetric } from '@rum/shared';
import { eq, type SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  lcpElementsSql,
  metricsSeriesSql,
  routesSummarySql,
  slowestInpTargetsSql,
  slowestPathsSql,
} from '../analytics/analytics.queries.js';
import { encodeCursor } from '../analytics/analytics.service.js';
import { DATABASE, DATABASE_POOL, type Database } from '../db/database.js';
import { projects, users } from '../db/schema.js';
import { DrizzleEventsRepository } from '../events/drizzle-events.repository.js';
import {
  RollupsService,
  rollupUpsertSql,
  startOfUtcHour,
} from '../rollups/rollups.service.js';
import { ScriptsModule } from './scripts.module.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WARM_RUNS = 10;
const INSERT_BATCHES = 5000;
const ROUTE = '/products/:id';

const dialect = new PgDialect();

interface Measured {
  name: string;
  description: string;
  plan: string;
  firstMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  rows: number;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

const ms = (value: number) => value.toFixed(1);

async function measure(
  client: Pool,
  name: string,
  description: string,
  query: SQL,
): Promise<Measured> {
  const { sql: text, params } = dialect.sqlToQuery(query);

  const started = performance.now();
  const first = await client.query(text, params);
  const firstMs = performance.now() - started;

  const timings: number[] = [];
  for (let i = 0; i < WARM_RUNS; i++) {
    const start = performance.now();
    await client.query(text, params);
    timings.push(performance.now() - start);
  }

  const explained = await client.query<{ 'QUERY PLAN': string }>(
    `explain (analyze, buffers) ${text}`,
    params,
  );
  const plan = explained.rows.map((row) => row['QUERY PLAN']).join('\n');
  console.log(`${name}: median ${ms(median(timings))} ms`);
  return {
    name,
    description,
    plan,
    firstMs,
    medianMs: median(timings),
    minMs: Math.min(...timings),
    maxMs: Math.max(...timings),
    rows: first.rowCount ?? 0,
  };
}

function rawSeriesSql(
  projectId: string,
  from: Date,
  to: Date,
  granularity: 'hour' | 'day',
  route?: string,
): SQL {
  return sql`
    select date_trunc(${granularity}, e.received_at, 'UTC') as time,
      count(*) as count,
      count(*) filter (where e.rating = 'good') as good,
      count(*) filter (where e.rating = 'needs-improvement') as ni,
      count(*) filter (where e.rating = 'poor') as poor,
      percentile_cont(0.75) within group (order by e.value) as value
    from events e
    where e.project_id = ${projectId} and e.metric = 'LCP'
      ${route ? sql`and e.route = ${route}` : sql``}
      and e.received_at >= ${from.toISOString()}::timestamptz
      and e.received_at < ${to.toISOString()}::timestamptz
    group by 1
    order by 1
  `;
}

function rawRoutesSql(projectId: string, from: Date, to: Date): SQL {
  return sql`
    select e.route, count(*) as count,
      count(*) filter (where e.rating = 'good') as good,
      count(*) filter (where e.rating = 'needs-improvement') as ni,
      count(*) filter (where e.rating = 'poor') as poor,
      percentile_cont(0.75) within group (order by e.value) as value
    from events e
    where e.project_id = ${projectId} and e.metric = 'LCP'
      and e.received_at >= ${from.toISOString()}::timestamptz
      and e.received_at < ${to.toISOString()}::timestamptz
    group by e.route
    order by value desc
  `;
}

async function measureInserts(db: Database, ownerId: string) {
  const [project] = await db
    .insert(projects)
    .values({ ownerId, name: 'perf-insert' })
    .returning({ id: projects.id });
  const repository = new DrizzleEventsRepository(db);
  const timings: number[] = [];
  try {
    for (let i = 0; i < INSERT_BATCHES; i++) {
      const receivedAt = new Date();
      const batch = Array.from({ length: 10 }, (_, j) => {
        const value = 500 + ((i * 10 + j) % 5000);
        return {
          clientEventId: randomUUID(),
          metric: 'LCP' as const,
          value,
          rating: rateMetric('LCP', value),
          path: `/products/${j}`,
          route: ROUTE,
          routeSource: 'server' as const,
          deviceType: 'mobile' as const,
          release: '2026.10.3',
          attribution: { target: 'img.hero' },
          projectId: project!.id,
          receivedAt,
        };
      });
      const start = performance.now();
      await repository.saveMany(batch);
      timings.push(performance.now() - start);
    }
  } finally {
    await db.execute(sql`delete from events where project_id = ${project!.id}`);
    await db.delete(projects).where(eq(projects.id, project!.id));
    await db.execute(sql`vacuum analyze events`);
  }
  const totalMs = timings.reduce((sum, value) => sum + value, 0);
  return {
    batches: INSERT_BATCHES,
    medianMs: median(timings),
    p99Ms: [...timings].sort((a, b) => a - b)[
      Math.floor(timings.length * 0.99)
    ]!,
    eventsPerSecond: (INSERT_BATCHES * 10) / (totalMs / 1000),
  };
}

async function relationSizes(db: Database) {
  const { rows } = await db.execute<{
    relation: string;
    kind: string;
    size: string;
    bytes: string;
  }>(sql`
    with parts as (
      select 'events' as parent, c.oid from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      where i.inhparent = 'events'::regclass
      union all
      select 'event_rollups_hourly', 'event_rollups_hourly'::regclass::oid
    ),
    rels as (
      select p.parent as relation, 'table' as kind,
        pg_relation_size(p.oid) as bytes from parts p
      union all
      select p.parent || ': ' ||
          regexp_replace(ic.relname, '^events_p\\d{8}_', 'events_pYYYYMMDD_'),
        'index', pg_relation_size(ix.indexrelid)
      from parts p
      join pg_index ix on ix.indrelid = p.oid
      join pg_class ic on ic.oid = ix.indexrelid
    )
    select relation, kind, pg_size_pretty(sum(bytes)) as size, sum(bytes) as bytes
    from rels group by relation, kind order by kind desc, relation
  `);
  return rows;
}

async function main(): Promise<void> {
  const label = argument('label') ?? 'run';
  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: ['error', 'warn'],
  });
  try {
    const db = app.get<Database>(DATABASE);
    const pool = app.get<Pool>(DATABASE_POOL, { strict: false });
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'seed@example.com'));
    if (!owner) throw new Error('Run the seed script first');
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, 'Shop (60%)'));
    const projectId = project!.id;

    const now = new Date();
    const to = new Date(startOfUtcHour(now).getTime() + HOUR_MS);
    const from30 = new Date(to.getTime() - 30 * DAY_MS);
    const from7 = new Date(to.getTime() - 7 * DAY_MS);
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const lcp = { projectId, metric: 'LCP' as const };

    const results: Measured[] = [];
    const run = async (name: string, description: string, query: SQL) =>
      results.push(await measure(pool, name, description, query));

    await run(
      'series-30d-hour-rollup',
      'p75 LCP series, 30 days, hourly, whole project (GET /metrics)',
      metricsSeriesSql(lcp, { from: from30, to }, 'hour'),
    );
    await run(
      'series-30d-hour-raw',
      'Same series computed from raw events with percentile_cont',
      rawSeriesSql(projectId, from30, to, 'hour'),
    );
    await run(
      'series-30d-day-route-rollup',
      `p75 LCP series, 30 days, daily, route ${ROUTE} (GET /metrics)`,
      metricsSeriesSql({ ...lcp, route: ROUTE }, { from: from30, to }, 'day'),
    );
    await run(
      'series-30d-day-route-raw',
      'Same series computed from raw events',
      rawSeriesSql(projectId, from30, to, 'day', ROUTE),
    );
    await run(
      'routes-7d-rollup',
      'Per-route LCP summary, 7 days (GET /routes)',
      routesSummarySql(lcp, { from: from7, to }),
    );
    await run(
      'routes-7d-raw',
      'Same summary computed from raw events',
      rawRoutesSql(projectId, from7, to),
    );
    await run(
      'routes-30d-rollup',
      'Per-route LCP summary, 30 days (GET /routes)',
      routesSummarySql(lcp, { from: from30, to }),
    );
    await run(
      'paths-page-1',
      `Slowest paths of ${ROUTE}, p75, 7 days, first page of 20 (GET /routes/paths)`,
      slowestPathsSql({ ...lcp, route: ROUTE }, since7, 0.75, 20),
    );
    const { rows: firstPage } = await db.execute<{
      path: string;
      value: number;
    }>(slowestPathsSql({ ...lcp, route: ROUTE }, since7, 0.75, 20));
    const last = firstPage[19]!;
    console.log(
      `cursor ${encodeCursor({ value: last.value, path: last.path })}`,
    );
    await run(
      'paths-page-2',
      'Second page via keyset cursor',
      slowestPathsSql({ ...lcp, route: ROUTE }, since7, 0.75, 20, {
        value: last.value,
        path: last.path,
      }),
    );
    await run(
      'attribution-lcp',
      `Top LCP elements of ${ROUTE}, 7 days (GET /routes/attribution)`,
      lcpElementsSql({ projectId, route: ROUTE }, since7),
    );
    await run(
      'attribution-inp',
      `Slowest INP targets of ${ROUTE}, 7 days (GET /routes/attribution)`,
      slowestInpTargetsSql({ projectId, route: ROUTE }, since7),
    );

    const rollups = app.get(RollupsService);
    const jobStart = Date.now();
    await rollups.recomputeRecent(now);
    console.log(`rollup job: ${Date.now() - jobStart} ms`);
    await run(
      'rollup-job-3h',
      'Rollup job: recompute last 3 hours from raw events and upsert',
      rollupUpsertSql(new Date(to.getTime() - 3 * HOUR_MS), to),
    );

    console.log('measuring inserts');
    const inserts = await measureInserts(db, owner.id);
    const sizes = await relationSizes(db);
    const { rows: settings } = await db.execute<{
      name: string;
      setting: string;
    }>(sql`
      select name, setting || coalesce(unit, '') as setting from pg_settings
      where name in ('server_version', 'shared_buffers', 'work_mem',
        'effective_cache_size', 'max_parallel_workers_per_gather', 'jit',
        'random_page_cost')
      order by name
    `);
    const { rows: counts } = await db.execute<{
      events: string;
      rollups: string;
    }>(
      sql`select (select count(*) from events) as events,
        (select count(*) from event_rollups_hourly) as rollups`,
    );

    const lines = [
      `# Perf run: ${label}`,
      '',
      `Run at ${now.toISOString()}. Events: ${counts[0]!.events}, rollup rows: ${counts[0]!.rollups}.`,
      `Timings are client-side wall time through node-postgres: first run, then ${WARM_RUNS} warm runs.`,
      '',
      '## Settings',
      '',
      ...settings.map((row) => `- ${row.name}: ${row.setting}`),
      '',
      '## Timings',
      '',
      '| query | rows | first ms | median ms | min ms | max ms |',
      '|---|---|---|---|---|---|',
      ...results.map(
        (r) =>
          `| ${r.name} | ${r.rows} | ${ms(r.firstMs)} | ${ms(r.medianMs)} | ${ms(r.minMs)} | ${ms(r.maxMs)} |`,
      ),
      '',
      '## Inserts',
      '',
      `${inserts.batches} batches of 10 events, one multi-row INSERT each: median ${ms(inserts.medianMs)} ms, p99 ${ms(inserts.p99Ms)} ms, ${Math.round(inserts.eventsPerSecond)} events/s.`,
      '',
      '## Sizes',
      '',
      '| relation | kind | size |',
      '|---|---|---|',
      ...sizes.map((row) => `| ${row.relation} | ${row.kind} | ${row.size} |`),
      '',
      '## Plans',
      '',
      ...results.flatMap((r) => [
        `### ${r.name}`,
        '',
        r.description,
        '',
        '```',
        r.plan,
        '```',
        '',
      ]),
    ];
    const out = resolve(process.cwd(), `../../docs/perf/raw/${label}.md`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, lines.join('\n'));
    console.log(`Wrote ${out}`);
  } finally {
    await app.close();
  }
}

await main();
