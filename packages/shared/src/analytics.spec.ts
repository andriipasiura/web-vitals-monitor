import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_LIMITS,
  AttributionQuerySchema,
  MetricsQuerySchema,
  PathsQuerySchema,
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
