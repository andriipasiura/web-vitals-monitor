import {
  bucketCount,
  bucketIndex,
  METRIC_NAMES,
  type MetricName,
} from '@rum/shared';
import type { ReleaseRouteRow } from './analytics.queries.js';
import { summarizeReleases } from './releases.js';

function row(
  metric: MetricName,
  release: string,
  route: string,
  value: number,
  count: number,
): ReleaseRouteRow {
  const buckets = new Array<number>(bucketCount(metric)).fill(0);
  buckets[bucketIndex(metric, value) - 1] = count;
  return { release, route, count: String(count), buckets: buckets.map(String) };
}

function spreadRow(
  metric: MetricName,
  release: string,
  route: string,
  values: number[],
): ReleaseRouteRow {
  const buckets = new Array<number>(bucketCount(metric)).fill(0);
  for (const value of values) buckets[bucketIndex(metric, value) - 1]! += 1;
  return {
    release,
    route,
    count: String(values.length),
    buckets: buckets.map(String),
  };
}

const uniform = (n: number, from: number, to: number) =>
  Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

function rowsOf(...rows: [MetricName, ReleaseRouteRow][]) {
  const result = Object.fromEntries(
    METRIC_NAMES.map((metric) => [metric, [] as ReleaseRouteRow[]]),
  ) as Record<MetricName, ReleaseRouteRow[]>;
  for (const [metric, r] of rows) result[metric].push(r);
  return result;
}

const firstSeen = new Map([
  ['1.0', new Date('2026-10-01T00:00:00Z')],
  ['1.1', new Date('2026-10-05T00:00:00Z')],
  ['1.2', new Date('2026-10-09T00:00:00Z')],
]);

describe('summarizeReleases', () => {
  it('orders releases newest first with changes against the previous release', () => {
    const { releases } = summarizeReleases(
      rowsOf(
        ['LCP', row('LCP', '1.0', '/a', 2000, 300)],
        ['LCP', row('LCP', '1.1', '/a', 3000, 300)],
        ['LCP', row('LCP', '1.2', '/a', 3000, 300)],
        ['INP', row('INP', '1.1', '/a', 100, 50)],
      ),
      firstSeen,
      'p75',
    );

    expect(releases.map((r) => r.release)).toEqual(['1.2', '1.1', '1.0']);
    expect(releases[1]!.count).toBe(350);
    const lcp = releases[1]!.metrics.LCP;
    expect(lcp.status).toBe('regressed');
    expect(lcp.change).toBeCloseTo(
      (lcp.value! - releases[2]!.metrics.LCP.value!) /
        releases[2]!.metrics.LCP.value!,
    );
    expect(releases[0]!.metrics.LCP.status).toBe('unchanged');
    expect(releases[2]!.metrics.LCP.change).toBeNull();
    expect(releases[0]!.metrics.INP).toEqual({
      value: null,
      count: 0,
      change: null,
      status: 'unchanged',
    });
  });

  it('picks the biggest per-route regression between consecutive releases', () => {
    const { regression } = summarizeReleases(
      rowsOf(
        ['LCP', row('LCP', '1.1', '/checkout', 2000, 400)],
        ['LCP', row('LCP', '1.2', '/checkout', 2600, 400)],
        ['LCP', row('LCP', '1.1', '/cart', 2000, 400)],
        ['LCP', row('LCP', '1.2', '/cart', 2300, 400)],
        ['LCP', row('LCP', '1.1', '/rare', 1000, 50)],
        ['LCP', row('LCP', '1.2', '/rare', 4000, 50)],
        ['INP', row('INP', '1.0', '/a', 100, 400)],
        ['INP', row('INP', '1.2', '/a', 400, 400)],
      ),
      firstSeen,
      'p75',
    );

    expect(regression).toMatchObject({
      metric: 'LCP',
      route: '/checkout',
      release: '1.2',
      previousRelease: '1.1',
      before: { count: 400 },
      after: { count: 400 },
    });
    expect(regression!.change).toBeGreaterThan(0.2);
  });

  it('prefers a clear regression over a bigger but noisy one', () => {
    const { regression } = summarizeReleases(
      rowsOf(
        ['LCP', spreadRow('LCP', '1.1', '/noisy', uniform(200, 500, 3500))],
        ['LCP', spreadRow('LCP', '1.2', '/noisy', uniform(200, 600, 4200))],
        ['LCP', spreadRow('LCP', '1.1', '/clear', uniform(2000, 1800, 2200))],
        ['LCP', spreadRow('LCP', '1.2', '/clear', uniform(2000, 2100, 2500))],
      ),
      firstSeen,
      'p75',
    );

    expect(regression).toMatchObject({ route: '/clear' });
  });

  it('returns no regression when nothing clears the thresholds', () => {
    const { regression } = summarizeReleases(
      rowsOf(
        ['LCP', row('LCP', '1.1', '/a', 2000, 400)],
        ['LCP', row('LCP', '1.2', '/a', 2100, 400)],
      ),
      firstSeen,
      'p75',
    );
    expect(regression).toBeNull();
  });
});
