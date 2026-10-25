import { z } from 'zod';

export const METRIC_NAMES = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;
export const MetricNameSchema = z.enum(METRIC_NAMES);
export type MetricName = z.infer<typeof MetricNameSchema>;

export const RATINGS = ['good', 'needs-improvement', 'poor'] as const;
export type Rating = (typeof RATINGS)[number];

export const METRIC_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 },
} as const satisfies Record<MetricName, { good: number; poor: number }>;

export function rateMetric(metric: MetricName, value: number): Rating {
  const thresholds = METRIC_THRESHOLDS[metric];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}
