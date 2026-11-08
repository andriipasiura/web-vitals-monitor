import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_LIMITS,
  AttributionQuerySchema,
  classifyChange,
  MetricsQuerySchema,
  PathsQuerySchema,
  relativeChange,
  ReleasesQuerySchema,
  RoutesQuerySchema,
} from './analytics.js';

const FROM = '2026-10-01T00:00:00Z';
const TO = '2026-10-31T00:00:00Z';

describe('MetricsQuerySchema', () => {
  it('applies defaults and camelCases filters', () => {
    expect(
      MetricsQuerySchema.parse({
        metric: 'LCP',
        from: FROM,
        to: TO,
        device_type: 'mobile',
      }),
    ).toEqual({
      metric: 'LCP',
      from: new Date(FROM),
      to: new Date(TO),
      percentile: 'p75',
      granularity: 'hour',
      deviceType: 'mobile',
    });
  });

  it('accepts timestamps with an offset', () => {
    const query = MetricsQuerySchema.parse({
      metric: 'INP',
      from: '2026-10-01T02:00:00+02:00',
      to: TO,
    });
    expect(query.from).toEqual(new Date(FROM));
  });

  it.each([
    [{ from: TO, to: FROM }, '`from` must be before `to`'],
    [
      { from: '2026-01-01T00:00:00Z', to: TO },
      `Period must not exceed ${ANALYTICS_LIMITS.maxRangeDays} days`,
    ],
  ])('rejects an invalid period %j', (period, message) => {
    const result = MetricsQuerySchema.safeParse({ metric: 'LCP', ...period });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['from'], message }),
    ]);
  });

  it.each([
    { metric: 'FID' },
    { from: '2026-10-01' },
    { percentile: 'p42' },
    { granularity: 'week' },
    { device_type: 'watch' },
    { route: 'products' },
  ])('rejects %j', (override) => {
    expect(
      MetricsQuerySchema.safeParse({
        metric: 'LCP',
        from: FROM,
        to: TO,
        ...override,
      }).success,
    ).toBe(false);
  });
});

describe('RoutesQuerySchema', () => {
  it('coerces and bounds the limit', () => {
    const base = { metric: 'LCP', from: FROM, to: TO };
    expect(RoutesQuerySchema.parse(base).limit).toBe(
      ANALYTICS_LIMITS.defaultRoutes,
    );
    expect(RoutesQuerySchema.parse({ ...base, limit: '10' }).limit).toBe(10);
    expect(RoutesQuerySchema.safeParse({ ...base, limit: '0' }).success).toBe(
      false,
    );
    expect(RoutesQuerySchema.safeParse({ ...base, limit: '201' }).success).toBe(
      false,
    );
  });

  it('accepts an optional sample minimum', () => {
    const base = { metric: 'LCP', from: FROM, to: TO };
    expect(RoutesQuerySchema.parse(base).minSamples).toBeUndefined();
    expect(
      RoutesQuerySchema.parse({ ...base, min_samples: '200' }).minSamples,
    ).toBe(200);
    expect(
      RoutesQuerySchema.safeParse({ ...base, min_samples: '0' }).success,
    ).toBe(false);
  });
});

describe('PathsQuerySchema', () => {
  it('requires a route and defaults the page size', () => {
    expect(PathsQuerySchema.safeParse({ metric: 'LCP' }).success).toBe(false);
    expect(
      PathsQuerySchema.parse({ metric: 'LCP', route: '/products/:id' }),
    ).toEqual({
      metric: 'LCP',
      route: '/products/:id',
      percentile: 'p75',
      limit: ANALYTICS_LIMITS.defaultPageSize,
    });
  });
});

describe('AttributionQuerySchema', () => {
  it('requires a route', () => {
    expect(AttributionQuerySchema.safeParse({}).success).toBe(false);
    expect(
      AttributionQuerySchema.parse({ route: '/', release: '1.0.0' }),
    ).toEqual({ route: '/', release: '1.0.0' });
  });
});

describe('ReleasesQuerySchema', () => {
  it('applies defaults and camelCases the device filter', () => {
    expect(
      ReleasesQuerySchema.parse({ from: FROM, to: TO, device_type: 'tablet' }),
    ).toEqual({
      from: new Date(FROM),
      to: new Date(TO),
      percentile: 'p75',
      deviceType: 'tablet',
    });
  });

  it('rejects an invalid period', () => {
    expect(ReleasesQuerySchema.safeParse({ from: TO, to: FROM }).success).toBe(
      false,
    );
  });
});

describe('classifyChange', () => {
  const n = ANALYTICS_LIMITS.minRegressionSamples;

  it.each([
    ['LCP', 2000, 2600, 'regressed'],
    ['LCP', 2600, 2000, 'improved'],
    ['LCP', 2000, 2150, 'unchanged'],
    ['LCP', 500, 590, 'unchanged'],
    ['INP', 100, 125, 'regressed'],
    ['INP', 100, 115, 'unchanged'],
    ['TTFB', 300, 345, 'unchanged'],
    ['CLS', 0.05, 0.08, 'regressed'],
    ['CLS', 0, 0.01, 'unchanged'],
    ['CLS', 0, 0.03, 'regressed'],
  ] as const)('%s %d -> %d is %s', (metric, before, after, expected) => {
    expect(
      classifyChange(
        metric,
        { value: before, count: n },
        { value: after, count: n },
      ),
    ).toBe(expected);
  });

  it('needs enough samples on both sides', () => {
    const big = { value: 4000, count: n };
    expect(classifyChange('LCP', { value: 2000, count: n - 1 }, big)).toBe(
      'unchanged',
    );
    expect(classifyChange('LCP', { value: 2000, count: n }, big)).toBe(
      'regressed',
    );
  });

  it('ignores missing values', () => {
    expect(
      classifyChange('LCP', { value: null, count: n }, { value: 1, count: n }),
    ).toBe('unchanged');
  });
});

describe('relativeChange', () => {
  it('is null without a non-zero baseline', () => {
    expect(relativeChange(2000, 2600)).toBeCloseTo(0.3);
    expect(relativeChange(0, 1)).toBeNull();
    expect(relativeChange(null, 1)).toBeNull();
  });
});
