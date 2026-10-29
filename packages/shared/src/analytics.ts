import { z } from 'zod';
import { DeviceTypeSchema, ReleaseSchema, RouteSchema } from './events.js';
import { MetricNameSchema } from './metrics.js';

export const ANALYTICS_LIMITS = {
  maxRangeDays: 90,
  rawLookbackDays: 7,
  defaultPageSize: 20,
  maxPageSize: 100,
  defaultRoutes: 50,
  maxRoutes: 200,
  maxAttributionTargets: 20,
  minInpTargetSamples: 5,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERCENTILES = ['p50', 'p75', 'p90', 'p95', 'p99'] as const;
export const PercentileSchema = z.enum(PERCENTILES);
export type Percentile = z.infer<typeof PercentileSchema>;

export const PERCENTILE_FRACTIONS = {
  p50: 0.5,
  p75: 0.75,
  p90: 0.9,
  p95: 0.95,
  p99: 0.99,
} as const satisfies Record<Percentile, number>;

export const GRANULARITIES = ['hour', 'day'] as const;
export const GranularitySchema = z.enum(GRANULARITIES);
export type Granularity = z.infer<typeof GranularitySchema>;

const timestamp = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s));

const limit = (defaultValue: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(defaultValue);

const filters = {
  device_type: DeviceTypeSchema.optional(),
  release: ReleaseSchema.optional(),
};

const period = {
  from: timestamp,
  to: timestamp,
};

function withValidPeriod<T extends { from: Date; to: Date }>(
  schema: z.ZodType<T>,
) {
  return schema.superRefine(({ from, to }, ctx) => {
    if (!(from instanceof Date) || !(to instanceof Date)) return;
    if (from >= to) {
      ctx.addIssue({
        code: 'custom',
        message: '`from` must be before `to`',
        path: ['from'],
      });
    } else if (
      to.getTime() - from.getTime() >
      ANALYTICS_LIMITS.maxRangeDays * DAY_MS
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `Period must not exceed ${ANALYTICS_LIMITS.maxRangeDays} days`,
        path: ['from'],
      });
    }
  });
}

export const MetricsQuerySchema = withValidPeriod(
  z.object({
    metric: MetricNameSchema,
    ...period,
    route: RouteSchema.optional(),
    ...filters,
    percentile: PercentileSchema.default('p75'),
    granularity: GranularitySchema.default('hour'),
  }),
).transform(({ device_type, ...query }) => ({
  ...query,
  deviceType: device_type,
}));
export type MetricsQuery = z.output<typeof MetricsQuerySchema>;

export const RoutesQuerySchema = withValidPeriod(
  z.object({
    metric: MetricNameSchema,
    ...period,
    ...filters,
    percentile: PercentileSchema.default('p75'),
    limit: limit(ANALYTICS_LIMITS.defaultRoutes, ANALYTICS_LIMITS.maxRoutes),
  }),
).transform(({ device_type, ...query }) => ({
  ...query,
  deviceType: device_type,
}));
export type RoutesQuery = z.output<typeof RoutesQuerySchema>;

export const PathsQuerySchema = z
  .object({
    metric: MetricNameSchema,
    route: RouteSchema,
    ...filters,
    percentile: PercentileSchema.default('p75'),
    limit: limit(
      ANALYTICS_LIMITS.defaultPageSize,
      ANALYTICS_LIMITS.maxPageSize,
    ),
    cursor: z.string().min(1).max(1024).optional(),
  })
  .transform(({ device_type, ...query }) => ({
    ...query,
    deviceType: device_type,
  }));
export type PathsQuery = z.output<typeof PathsQuerySchema>;

export const AttributionQuerySchema = z
  .object({
    route: RouteSchema,
    ...filters,
  })
  .transform(({ device_type, ...query }) => ({
    ...query,
    deviceType: device_type,
  }));
export type AttributionQuery = z.output<typeof AttributionQuerySchema>;
