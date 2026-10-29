import { Inject, Injectable } from '@nestjs/common';
import { METRIC_BUCKET_BOUNDARIES, METRIC_NAMES } from '@rum/shared';
import { type SQL, sql } from 'drizzle-orm';
import {
  ADVISORY_LOCKS,
  type LockResult,
  type Transaction,
  withAdvisoryXactLock,
} from '../db/advisory-lock.js';
import { DATABASE, type Database } from '../db/database.js';

const HOUR_MS = 60 * 60 * 1000;

export const ROLLUP_WINDOW_HOURS = 3;

export function startOfUtcHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}

export function bucketEdgesValues(): SQL {
  const rows = METRIC_NAMES.map((metric) => {
    const edges = METRIC_BUCKET_BOUNDARIES[metric];
    const negated = `{${[...edges]
      .reverse()
      .map((edge) => -edge)
      .join(',')}}`;
    return sql`(${metric}, ${negated}::float8[], ${edges.length}::int)`;
  });
  return sql`(values ${sql.join(rows, sql`, `)}) as edges(metric, neg_edges, n)`;
}

export const bucketIndexSql = sql`edges.n - width_bucket(-e.value, edges.neg_edges) + 1`;

export function rollupUpsertSql(from: Date, to: Date): SQL {
  const start = startOfUtcHour(from);
  const end = startOfUtcHour(new Date(to.getTime() + HOUR_MS - 1));
  return sql`
      with per_bucket as (
        select e.project_id, e.metric, e.route, e.device_type, e.release,
          date_trunc('hour', e.received_at, 'UTC') as hour,
          ${bucketIndexSql} as idx,
          count(*) as n,
          count(*) filter (where e.rating = 'good') as good,
          count(*) filter (where e.rating = 'needs-improvement') as ni,
          count(*) filter (where e.rating = 'poor') as poor,
          sum(e.value) as sum_value
        from events e
        join ${bucketEdgesValues()} on edges.metric = e.metric
        where e.received_at >= ${start.toISOString()}::timestamptz
          and e.received_at < ${end.toISOString()}::timestamptz
        group by 1, 2, 3, 4, 5, 6, 7
      ),
      grouped as (
        select project_id, metric, route, device_type, release, hour,
          sum(n)::int as count,
          sum(good)::int as good_count,
          sum(ni)::int as ni_count,
          sum(poor)::int as poor_count,
          sum(sum_value) as sum_value,
          array_agg(idx) as idxs,
          array_agg(n) as counts
        from per_bucket
        group by 1, 2, 3, 4, 5, 6
      )
      insert into event_rollups_hourly (project_id, metric, route,
        device_type, release, hour, count, good_count, ni_count, poor_count,
        sum_value, buckets)
      select g.project_id, g.metric, g.route, g.device_type, g.release, g.hour,
        g.count, g.good_count, g.ni_count, g.poor_count, g.sum_value,
        (select array_agg(coalesce(u.n, 0)::int order by s.i)
          from generate_series(1, edges.n + 1) as s(i)
          left join unnest(g.idxs, g.counts) as u(i, n) on u.i = s.i)
      from grouped g
      join ${bucketEdgesValues()} on edges.metric = g.metric
      on conflict on constraint event_rollups_hourly_key do update set
        count = excluded.count,
        good_count = excluded.good_count,
        ni_count = excluded.ni_count,
        poor_count = excluded.poor_count,
        sum_value = excluded.sum_value,
        buckets = excluded.buckets
  `;
}

@Injectable()
export class RollupsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async recompute(
    from: Date,
    to: Date,
    executor: Database | Transaction = this.db,
  ): Promise<number> {
    const result = await executor.execute(rollupUpsertSql(from, to));
    return result.rowCount ?? 0;
  }

  recomputeRecent(now = new Date()): Promise<LockResult<number>> {
    const end = new Date(startOfUtcHour(now).getTime() + HOUR_MS);
    const start = new Date(end.getTime() - ROLLUP_WINDOW_HOURS * HOUR_MS);
    return withAdvisoryXactLock(this.db, ADVISORY_LOCKS.rollups, (tx) =>
      this.recompute(start, end, tx),
    );
  }
}
