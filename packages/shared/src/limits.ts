export const METRIC_NAMES = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;

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

export const CONNECTION_TYPES = ['slow-2g', '2g', '3g', '4g'] as const;

export const PATH_PATTERN = /^\/[^?#\s]*$/;
