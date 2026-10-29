import {
  ANALYTICS_LIMITS,
  bucketCount,
  type DeviceType,
  type Granularity,
  type MetricName,
} from '@rum/shared';
import { type SQL, sql } from 'drizzle-orm';

export interface Filters {
  projectId: string;
  metric: MetricName;
  route?: string;
  deviceType?: DeviceType;
  release?: string;
}

export interface Period {
  from: Date;
  to: Date;
}

export type TotalsRow = {
  count: string;
  good: string;
  ni: string;
  poor: string;
};

export type SeriesRow = TotalsRow & { time: string; buckets: string[] };

export type RouteRow = TotalsRow & { route: string; buckets: string[] };

export type PathRow = TotalsRow & { path: string; value: number };

export type TargetRow = { target: string; count: string; p75: number };

function filterConditions(alias: string, filters: Filters): SQL {
  const column = (name: string) => sql.raw(`${alias}.${name}`);
  const conditions = [
    sql`${column('project_id')} = ${filters.projectId}`,
    sql`${column('metric')} = ${filters.metric}`,
  ];
  if (filters.route !== undefined) {
    conditions.push(sql`${column('route')} = ${filters.route}`);
  }
  if (filters.deviceType !== undefined) {
    conditions.push(sql`${column('device_type')} = ${filters.deviceType}`);
  }
  if (filters.release !== undefined) {
    conditions.push(sql`${column('release')} = ${filters.release}`);
  }
  return sql.join(conditions, sql` and `);
}

const rollupPeriod = ({ from, to }: Period) =>
  sql`r.hour >= date_trunc('hour', ${from.toISOString()}::timestamptz)
    and r.hour < ${to.toISOString()}::timestamptz`;

function bucketSums(metric: MetricName): SQL {
  const sums = Array.from(
    { length: bucketCount(metric) },
    (_, i) => `sum(r.buckets[${i + 1}])`,
  );
  return sql.raw(`array[${sums.join(', ')}]`);
}

const totals = sql`sum(r.count)::int8 as count,
  sum(r.good_count)::int8 as good,
  sum(r.ni_count)::int8 as ni,
  sum(r.poor_count)::int8 as poor`;

export function metricsSeriesSql(
  filters: Filters,
  period: Period,
  granularity: Granularity,
): SQL {
  const time =
    granularity === 'day' ? sql`date_trunc('day', r.hour, 'UTC')` : sql`r.hour`;
  return sql`
    select ${time} as time, ${totals}, ${bucketSums(filters.metric)} as buckets
    from event_rollups_hourly r
    where ${filterConditions('r', filters)} and ${rollupPeriod(period)}
    group by 1
    order by 1
  `;
}

export function routesSummarySql(filters: Filters, period: Period): SQL {
  return sql`
    select r.route, ${totals}, ${bucketSums(filters.metric)} as buckets
    from event_rollups_hourly r
    where ${filterConditions('r', filters)} and ${rollupPeriod(period)}
    group by r.route
  `;
}

const rawSince = (since: Date) =>
  sql`e.received_at >= ${since.toISOString()}::timestamptz`;

export interface PathsCursor {
  value: number;
  path: string;
}

export function slowestPathsSql(
  filters: Filters & { route: string },
  since: Date,
  fraction: number,
  limit: number,
  cursor?: PathsCursor,
): SQL {
  const after = cursor
    ? sql`where value < ${cursor.value} or (value = ${cursor.value} and path > ${cursor.path})`
    : sql``;
  return sql`
    with per_path as (
      select e.path, count(*)::int8 as count,
        count(*) filter (where e.rating = 'good')::int8 as good,
        count(*) filter (where e.rating = 'needs-improvement')::int8 as ni,
        count(*) filter (where e.rating = 'poor')::int8 as poor,
        percentile_cont(${fraction}::float8) within group (order by e.value) as value
      from events e
      where ${filterConditions('e', filters)} and ${rawSince(since)}
      group by e.path
    )
    select path, count, good, ni, poor, value
    from per_path
    ${after}
    order by value desc, path asc
    limit ${limit + 1}
  `;
}

type AttributionFilters = Omit<Filters, 'metric'> & { route: string };

export function lcpElementsSql(filters: AttributionFilters, since: Date): SQL {
  return sql`
    select e.attribution->>'target' as target, count(*)::int8 as count,
      percentile_cont(0.75) within group (order by e.value) as p75
    from events e
    where ${filterConditions('e', { ...filters, metric: 'LCP' })}
      and ${rawSince(since)}
      and e.attribution->>'target' is not null
    group by 1
    order by count desc, target
    limit ${ANALYTICS_LIMITS.maxAttributionTargets}
  `;
}

export function slowestInpTargetsSql(
  filters: AttributionFilters,
  since: Date,
): SQL {
  return sql`
    select e.attribution->>'interactionTarget' as target,
      count(*)::int8 as count,
      percentile_cont(0.75) within group (order by e.value) as p75
    from events e
    where ${filterConditions('e', { ...filters, metric: 'INP' })}
      and ${rawSince(since)}
      and e.attribution->>'interactionTarget' is not null
    group by 1
    having count(*) >= ${ANALYTICS_LIMITS.minInpTargetSamples}
    order by p75 desc, target
    limit ${ANALYTICS_LIMITS.maxAttributionTargets}
  `;
}
