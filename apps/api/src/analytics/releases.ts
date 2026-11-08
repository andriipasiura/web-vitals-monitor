import {
  classifyChange,
  METRIC_NAMES,
  type ChangeStatus,
  type MetricName,
  PERCENTILE_FRACTIONS,
  type Percentile,
  percentileFromHistogram,
  percentileStandardError,
  relativeChange,
  type Sample,
} from '@rum/shared';
import type { ReleaseRouteRow } from './analytics.queries.js';

export interface ReleaseMetric extends Sample {
  change: number | null;
  status: ChangeStatus;
}

export interface ReleaseSummary {
  release: string;
  firstSeen: Date;
  count: number;
  metrics: Record<MetricName, ReleaseMetric>;
}

export interface Regression {
  metric: MetricName;
  route: string;
  release: string;
  previousRelease: string;
  before: Sample;
  after: Sample;
  change: number | null;
}

interface Histogram {
  count: number;
  buckets: number[];
}

function add(target: Histogram | undefined, row: ReleaseRouteRow): Histogram {
  const buckets = row.buckets.map(Number);
  if (!target) return { count: Number(row.count), buckets };
  target.count += Number(row.count);
  buckets.forEach((n, i) => (target.buckets[i] = (target.buckets[i] ?? 0) + n));
  return target;
}

const sample = (
  metric: MetricName,
  histogram: Histogram | undefined,
  fraction: number,
): Sample =>
  histogram
    ? {
        value: percentileFromHistogram(metric, histogram.buckets, fraction),
        count: histogram.count,
      }
    : { value: null, count: 0 };

function confidence(
  metric: MetricName,
  before: Histogram,
  after: Histogram,
  difference: number,
): number {
  const a = percentileStandardError(metric, before.buckets, 0.75);
  const b = percentileStandardError(metric, after.buckets, 0.75);
  if (a === null || b === null) return 0;
  return difference / (Math.hypot(a, b) || Infinity);
}

export function summarizeReleases(
  rows: Record<MetricName, ReleaseRouteRow[]>,
  firstSeen: Map<string, Date>,
  percentile: Percentile,
): { releases: ReleaseSummary[]; regression: Regression | null } {
  const order = [...firstSeen.entries()]
    .sort(([a, x], [b, y]) => x.getTime() - y.getTime() || a.localeCompare(b))
    .map(([release]) => release);
  const fraction = PERCENTILE_FRACTIONS[percentile];
  const p75 = PERCENTILE_FRACTIONS.p75;

  const totals = new Map<string, number>();
  const releases: ReleaseSummary[] = order.map((release) => ({
    release,
    firstSeen: firstSeen.get(release)!,
    count: 0,
    metrics: {} as Record<MetricName, ReleaseMetric>,
  }));
  let regression: Regression | null = null;
  let best = 0;

  for (const metric of METRIC_NAMES) {
    const byRelease = new Map<string, Histogram>();
    const byRoute = new Map<string, Map<string, Histogram>>();
    for (const row of rows[metric]) {
      byRelease.set(row.release, add(byRelease.get(row.release), row));
      const routes = byRoute.get(row.route) ?? new Map<string, Histogram>();
      routes.set(row.release, add(undefined, row));
      byRoute.set(row.route, routes);
      totals.set(
        row.release,
        (totals.get(row.release) ?? 0) + Number(row.count),
      );
    }

    releases.forEach((summary, i) => {
      const after = sample(metric, byRelease.get(summary.release), fraction);
      const previous = i > 0 ? releases[i - 1]!.metrics[metric] : undefined;
      summary.metrics[metric] = {
        ...after,
        change: relativeChange(previous?.value ?? null, after.value),
        status: previous
          ? classifyChange(metric, previous, after)
          : 'unchanged',
      };
    });

    for (const [route, histograms] of byRoute) {
      for (let i = 1; i < order.length; i++) {
        const previous = histograms.get(order[i - 1]!);
        const current = histograms.get(order[i]!);
        if (!previous || !current) continue;
        const before = sample(metric, previous, p75);
        const after = sample(metric, current, p75);
        if (classifyChange(metric, before, after) !== 'regressed') continue;
        const score = confidence(
          metric,
          previous,
          current,
          after.value! - before.value!,
        );
        if (score <= best) continue;
        best = score;
        regression = {
          metric,
          route,
          release: order[i]!,
          previousRelease: order[i - 1]!,
          before,
          after,
          change: relativeChange(before.value, after.value),
        };
      }
    }
  }

  for (const summary of releases)
    summary.count = totals.get(summary.release) ?? 0;
  return { releases: releases.reverse(), regression };
}
