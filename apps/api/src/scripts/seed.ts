import { NestFactory } from '@nestjs/core';
import { hash } from '@node-rs/argon2';
import { METRIC_NAMES, METRIC_THRESHOLDS } from '@rum/shared';
import { eq, sql } from 'drizzle-orm';
import { ARGON2_OPTIONS } from '../auth/auth.service.js';
import { DATABASE, type Database } from '../db/database.js';
import { projects, users } from '../db/schema.js';
import { createPartition } from '../events/partitions.service.js';
import { RollupsService } from '../rollups/rollups.service.js';
import { ScriptsModule } from './scripts.module.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_EMAIL = 'seed@example.com';
const SEED_PASSWORD = 'seed-password';

const SECTIONS = [
  'products',
  'categories',
  'blog',
  'docs',
  'account',
  'orders',
  'cart',
  'checkout',
  'search',
  'help',
  'careers',
  'news',
  'events',
  'stores',
  'brands',
  'deals',
  'reviews',
  'compare',
  'wishlist',
  'gifts',
  'support',
  'guides',
  'recipes',
  'videos',
  'podcasts',
  'authors',
  'teams',
  'projects',
  'invoices',
  'billing',
  'settings',
  'reports',
  'dashboards',
  'alerts',
  'integrations',
  'partners',
  'pricing',
  'legal',
  'press',
  'community',
];

const ROUTES = SECTIONS.flatMap((section) => [
  `/${section}`,
  `/${section}/:id`,
  `/${section}/:id/reviews`,
  `/${section}/new`,
  `/${section}/archive`,
]);

const RELEASES = [
  '2026.9.1',
  '2026.9.2',
  '2026.10.1',
  '2026.10.2',
  '2026.10.3',
];
const REGRESSED_RELEASE = RELEASES[2]!;

const LCP_TARGETS = [
  'img.hero',
  'h1.title',
  'div.banner > img',
  'picture.product-image > img',
  'p.lead',
  'video.intro',
  'section.cards img',
  'main > div.carousel img',
];
const INP_TARGETS = [
  'button.add-to-cart',
  'a.nav-link',
  'input#search',
  'button.menu',
  'select.sort',
  'button.checkout',
  'div.filters label',
  'button.load-more',
  'a.product-card',
  'button.accept-cookies',
];
const CLS_TARGETS = ['div.ad-slot', 'img.lazy', 'div.cookie-banner', 'footer'];

const pgArray = (values: readonly string[]) =>
  `{${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(',')}}`;

function ratingCase(): string {
  const branches = METRIC_NAMES.map((metric) => {
    const { good, poor } = METRIC_THRESHOLDS[metric];
    return `when metric = '${metric}' then case when value <= ${good} then 'good' when value <= ${poor} then 'needs-improvement' else 'poor' end`;
  });
  return `case ${branches.join(' ')} end`;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

async function insertChunk(
  db: Database,
  projectIds: string[],
  seedStart: Date,
  from: Date,
  to: Date,
  count: number,
): Promise<void> {
  const seconds = (to.getTime() - from.getTime()) / 1000;
  await db.execute(sql`
    insert into events (project_id, metric, value, rating, path, route,
      route_source, device_type, connection_type, release, attribution,
      client_event_id, received_at)
    with raw as (
      select
        ${from.toISOString()}::timestamptz
          + (x + 0.6 * sin(2 * pi() * x) / (2 * pi())) * ${seconds}::float8
          * interval '1 second' as received_at,
        random() as rp, random() as rr, random() as rd, random() as rm,
        random() as rc, random() as rrel, random() as ra, random() as rz,
        sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()) as z,
        floor(random() * 1000)::int + 1 as id_num
      from (select random() as x from generate_series(1, ${count})) g
    ),
    dims as (
      select received_at, z, rz, ra, rc, id_num,
        (${pgArray(projectIds)}::uuid[])[case when rp < 0.6 then 1 when rp < 0.9 then 2 else 3 end] as project_id,
        (${pgArray(ROUTES)}::text[])[floor(${ROUTES.length} * power(rr, 3))::int + 1] as route,
        case when rd < 0.55 then 'mobile' when rd < 0.95 then 'desktop' else 'tablet' end as device_type,
        case when rm < 0.22 then 'LCP' when rm < 0.44 then 'FCP'
          when rm < 0.66 then 'TTFB' when rm < 0.88 then 'CLS' else 'INP' end as metric,
        case when rrel < 0.1 then null else
          (${pgArray(RELEASES)}::text[])[greatest(1, least(${RELEASES.length},
            floor(extract(epoch from received_at - ${seedStart.toISOString()}::timestamptz)
              / ${(6 * DAY_MS) / 1000})::int + 1 - (rrel < 0.3)::int))]
        end as release
      from raw
    ),
    vals as (
      select *,
        case
          when metric = 'CLS' then
            case when rz < 0.4 then 0
              else round((0.05 * exp(1.1 * z) * case device_type when 'mobile' then 1.4 else 1 end)::numeric, 4)::float8 end
          else round(
            (case metric when 'LCP' then 1800 when 'FCP' then 1200 when 'TTFB' then 450 else 110 end)
            * case device_type when 'mobile' then 1.5 when 'tablet' then 1.2 else 1 end
            * case when metric = 'LCP' and release = ${REGRESSED_RELEASE} then 1.4 else 1 end
            * case when rz > 0.98 then 4 else 1 end
            * exp((case metric when 'LCP' then 0.55 when 'FCP' then 0.5 when 'TTFB' then 0.7 else 0.8 end) * z)
          )::float8
        end as value
      from dims
    )
    select project_id, metric, value, ${sql.raw(ratingCase())},
      replace(route, ':id', id_num::text), route,
      case when ra < 0.3 then 'sdk' else 'server' end,
      device_type,
      case when rc < 0.7 then '4g' when rc < 0.85 then '3g' when rc < 0.88 then '2g' end,
      release,
      case
        when metric = 'LCP' and ra < 0.9 then jsonb_build_object('target',
          (${pgArray(LCP_TARGETS)}::text[])[floor(${LCP_TARGETS.length} * power(ra / 0.9, 2))::int + 1])
        when metric = 'INP' and ra < 0.9 then jsonb_build_object('interactionTarget',
          (${pgArray(INP_TARGETS)}::text[])[floor(${INP_TARGETS.length} * power(ra / 0.9, 2))::int + 1])
        when metric = 'CLS' and value > 0 then jsonb_build_object('largestShiftTarget',
          (${pgArray(CLS_TARGETS)}::text[])[floor(${CLS_TARGETS.length} * ra)::int + 1])
      end,
      gen_random_uuid(), received_at
    from vals
    order by received_at
  `);
}

async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    console.error(
      'This deletes all events and rollups and the seed user. Rerun with --yes.',
    );
    process.exitCode = 1;
    return;
  }
  const total = Number(argument('events') ?? 10_000_000);
  const days = Number(argument('days') ?? 30);

  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: ['error', 'warn'],
  });
  try {
    const db = app.get<Database>(DATABASE);
    const log = (message: string) =>
      console.log(`[${new Date().toISOString()}] ${message}`);

    await db.execute(sql`truncate events, event_rollups_hourly`);
    await db.delete(users).where(eq(users.email, SEED_EMAIL));
    const [user] = await db
      .insert(users)
      .values({
        email: SEED_EMAIL,
        passwordHash: await hash(SEED_PASSWORD, ARGON2_OPTIONS),
      })
      .returning({ id: users.id });
    const seeded = await db
      .insert(projects)
      .values(
        ['Shop (60%)', 'Blog (30%)', 'Docs (10%)'].map((name) => ({
          ownerId: user!.id,
          name,
          allowedOrigins: ['https://seed.example'],
        })),
      )
      .returning({ id: projects.id, name: projects.name });
    const projectIds = seeded.map((project) => project.id);
    log(`Seed user ${SEED_EMAIL} / ${SEED_PASSWORD}`);
    for (const project of seeded) log(`Project ${project.name}: ${project.id}`);

    const end = new Date();
    const start = new Date(end.getTime() - days * DAY_MS);
    const dayStart = (date: Date) =>
      new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);

    for (
      let day = dayStart(start);
      day < end;
      day = new Date(day.getTime() + DAY_MS)
    ) {
      await createPartition(db, day);
    }

    let inserted = 0;
    for (
      let day = dayStart(start);
      day < end;
      day = new Date(day.getTime() + DAY_MS)
    ) {
      const from = day < start ? start : day;
      const next = new Date(day.getTime() + DAY_MS);
      const to = next > end ? end : next;
      const count = Math.round(
        (total * (to.getTime() - from.getTime())) /
          (end.getTime() - start.getTime()),
      );
      if (count === 0) continue;
      await insertChunk(db, projectIds, start, from, to, count);
      inserted += count;
      log(
        `Inserted ${count} events for ${day.toISOString().slice(0, 10)} (${inserted} total)`,
      );
    }

    const rollups = app.get(RollupsService);
    for (
      let day = dayStart(start);
      day < end;
      day = new Date(day.getTime() + DAY_MS)
    ) {
      const rows = await rollups.recompute(
        day,
        new Date(day.getTime() + DAY_MS),
      );
      log(`Rolled up ${day.toISOString().slice(0, 10)}: ${rows} rows`);
    }

    log('VACUUM ANALYZE');
    await db.execute(sql`vacuum analyze events`);
    await db.execute(sql`vacuum analyze event_rollups_hourly`);
    log('Done');
  } finally {
    await app.close();
  }
}

await main();
