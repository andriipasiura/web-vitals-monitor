import { describe, expect, it } from 'vitest';
import {
  bucketCount,
  bucketIndex,
  METRIC_BUCKET_BOUNDARIES,
  percentileFromHistogram,
} from './histogram.js';
import { METRIC_NAMES, METRIC_THRESHOLDS, rateMetric } from './metrics.js';

function histogram(
  metric: (typeof METRIC_NAMES)[number],
  values: number[],
): number[] {
  const buckets = new Array<number>(bucketCount(metric)).fill(0);
  for (const value of values) buckets[bucketIndex(metric, value) - 1]! += 1;
  return buckets;
}

describe('METRIC_BUCKET_BOUNDARIES', () => {
  it.each(METRIC_NAMES)('%s edges are strictly ascending', (metric) => {
    const edges = METRIC_BUCKET_BOUNDARIES[metric];
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i]).toBeGreaterThan(edges[i - 1]!);
    }
  });

  it.each(METRIC_NAMES)('%s good and poor thresholds are edges', (metric) => {
    const { good, poor } = METRIC_THRESHOLDS[metric];
    const edges: readonly number[] = METRIC_BUCKET_BOUNDARIES[metric];
    expect(edges).toContain(good);
    expect(edges).toContain(poor);
  });

  it('has the specified bucket counts', () => {
    expect(bucketCount('LCP')).toBe(65);
    expect(bucketCount('FCP')).toBe(65);
    expect(bucketCount('INP')).toBe(54);
    expect(bucketCount('TTFB')).toBe(69);
    expect(bucketCount('CLS')).toBe(65);
  });

  it('builds exact CLS edges', () => {
    expect(METRIC_BUCKET_BOUNDARIES.CLS.slice(0, 3)).toEqual([
      0.01, 0.02, 0.03,
    ]);
    expect(METRIC_BUCKET_BOUNDARIES.CLS).toContain(0.07);
    expect(METRIC_BUCKET_BOUNDARIES.CLS.slice(-5)).toEqual([1, 1.5, 2, 3, 5]);
  });
});

describe('bucketIndex', () => {
  it('uses inclusive upper edges', () => {
    expect(bucketIndex('LCP', 0)).toBe(1);
    expect(bucketIndex('LCP', 100)).toBe(1);
    expect(bucketIndex('LCP', 100.5)).toBe(2);
    expect(bucketIndex('LCP', 60000)).toBe(64);
    expect(bucketIndex('LCP', 60000.1)).toBe(65);
  });

  it.each(METRIC_NAMES)(
    'puts %s values on the same side of a threshold as rateMetric',
    (metric) => {
      const { good, poor } = METRIC_THRESHOLDS[metric];
      const lastGood = bucketIndex(metric, good);
      const lastNi = bucketIndex(metric, poor);
      for (const value of [0, good, good + 0.001, poor, poor + 0.001, 1e6]) {
        const index = bucketIndex(metric, value);
        const expected =
          index <= lastGood
            ? 'good'
            : index <= lastNi
              ? 'needs-improvement'
              : 'poor';
        expect(rateMetric(metric, value)).toBe(expected);
      }
    },
  );
});

describe('percentileFromHistogram', () => {
  it('returns null for an empty histogram', () => {
    expect(percentileFromHistogram('LCP', histogram('LCP', []), 0.75)).toBe(
      null,
    );
  });

  it('interpolates linearly inside a bucket', () => {
    const buckets = histogram('LCP', [2010, 2020, 2030, 2040]);
    expect(percentileFromHistogram('LCP', buckets, 0.5)).toBe(2050);
    expect(percentileFromHistogram('LCP', buckets, 0.75)).toBe(2075);
  });

  it('interpolates across buckets', () => {
    const buckets = histogram('LCP', [10, 20, 30, 150]);
    expect(percentileFromHistogram('LCP', buckets, 0.75)).toBe(100);
    expect(percentileFromHistogram('LCP', buckets, 0.9)).toBeCloseTo(160);
  });

  it('skips empty buckets', () => {
    const buckets = histogram('INP', [10, 900]);
    expect(percentileFromHistogram('INP', buckets, 0.75)).toBe(887.5);
  });

  it('returns the lower edge of the unbounded bucket', () => {
    const buckets = histogram('LCP', [70000, 80000]);
    expect(percentileFromHistogram('LCP', buckets, 0.99)).toBe(60000);
  });

  it('rejects a histogram of the wrong size', () => {
    expect(() => percentileFromHistogram('LCP', [1, 2], 0.5)).toThrow(
      'Expected 65 buckets for LCP, got 2',
    );
  });
});
