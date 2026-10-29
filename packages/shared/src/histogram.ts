import type { MetricName } from './metrics.js';

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += step) values.push(value);
  return values;
}

const LOADING_EDGES = [
  ...range(100, 5000, 100),
  ...range(5500, 10000, 500),
  15000,
  20000,
  30000,
  60000,
];

const CLS_EDGES = [
  ...range(1, 50, 1),
  ...range(55, 100, 5),
  150,
  200,
  300,
  500,
].map((hundredths) => hundredths / 100);

export const METRIC_BUCKET_BOUNDARIES = {
  LCP: LOADING_EDGES,
  FCP: LOADING_EDGES,
  INP: [...range(25, 1000, 25), ...range(1100, 2000, 100), 3000, 5000, 10000],
  TTFB: [...range(50, 3000, 50), ...range(3500, 6000, 500), 10000, 30000],
  CLS: CLS_EDGES,
} as const satisfies Record<MetricName, readonly number[]>;

export function bucketCount(metric: MetricName): number {
  return METRIC_BUCKET_BOUNDARIES[metric].length + 1;
}

export function bucketIndex(metric: MetricName, value: number): number {
  const edges = METRIC_BUCKET_BOUNDARIES[metric];
  const index = edges.findIndex((edge) => value <= edge);
  return (index === -1 ? edges.length : index) + 1;
}

export function percentileFromHistogram(
  metric: MetricName,
  buckets: readonly number[],
  p: number,
): number | null {
  const edges = METRIC_BUCKET_BOUNDARIES[metric];
  if (buckets.length !== edges.length + 1) {
    throw new Error(
      `Expected ${edges.length + 1} buckets for ${metric}, got ${buckets.length}`,
    );
  }

  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;

  const rank = p * total;
  let below = 0;
  for (const [i, count] of buckets.entries()) {
    if (count > 0 && below + count >= rank) {
      const lower = i === 0 ? 0 : edges[i - 1]!;
      const upper = edges[i];
      if (upper === undefined) return lower;
      return lower + ((upper - lower) * (rank - below)) / count;
    }
    below += count;
  }
  return edges[edges.length - 1]!;
}
