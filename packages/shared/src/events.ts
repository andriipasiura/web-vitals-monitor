import { z } from 'zod';
import { MetricNameSchema } from './metrics.js';

export const EVENT_LIMITS = {
  maxEventsPerBatch: 10,
  maxPathLength: 512,
  maxRouteLength: 512,
  maxReleaseLength: 64,
  maxAttributionKeys: 16,
  maxAttributionKeyLength: 64,
  maxAttributionValueLength: 128,
} as const;

export const MAX_BATCH_BODY_BYTES = 32 * 1024;

export const DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;
export const DeviceTypeSchema = z.enum(DEVICE_TYPES);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const CONNECTION_TYPES = ['slow-2g', '2g', '3g', '4g'] as const;
export const ConnectionTypeSchema = z.enum(CONNECTION_TYPES);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

const PATH_PATTERN = /^\/[^?#\s]*$/;

const pathLike = (maxLength: number) =>
  z.string().max(maxLength).regex(PATH_PATTERN, {
    error:
      'Must start with "/" and contain no query string, fragment or whitespace',
  });

export const AttributionSchema = z
  .record(
    z.string().min(1).max(EVENT_LIMITS.maxAttributionKeyLength),
    z.union([
      z.string().max(EVENT_LIMITS.maxAttributionValueLength),
      z.number(),
    ]),
  )
  .refine(
    (attribution) =>
      Object.keys(attribution).length <= EVENT_LIMITS.maxAttributionKeys,
    {
      error: `Must have at most ${EVENT_LIMITS.maxAttributionKeys} entries`,
    },
  );
export type Attribution = z.infer<typeof AttributionSchema>;

export const RouteSchema = pathLike(EVENT_LIMITS.maxRouteLength);
export const ReleaseSchema = z
  .string()
  .min(1)
  .max(EVENT_LIMITS.maxReleaseLength);

export const WebVitalEventSchema = z.object({
  clientEventId: z.uuid(),
  metric: MetricNameSchema,
  value: z.number().nonnegative(),
  path: pathLike(EVENT_LIMITS.maxPathLength),
  route: RouteSchema.optional(),
  deviceType: DeviceTypeSchema,
  connectionType: ConnectionTypeSchema.optional(),
  release: ReleaseSchema.optional(),
  attribution: AttributionSchema.optional(),
});
export type WebVitalEvent = z.infer<typeof WebVitalEventSchema>;

export const EventBatchSchema = z.object({
  events: z
    .array(WebVitalEventSchema)
    .min(1)
    .max(EVENT_LIMITS.maxEventsPerBatch),
});
export type EventBatch = z.infer<typeof EventBatchSchema>;
