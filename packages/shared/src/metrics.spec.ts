import { describe, expect, it } from 'vitest';
import { METRIC_NAMES, METRIC_THRESHOLDS, rateMetric } from './metrics.js';

describe('rateMetric', () => {
  it.each(METRIC_NAMES)(
    'treats %s thresholds as inclusive upper bounds',
    (metric) => {
      const { good, poor } = METRIC_THRESHOLDS[metric];

      expect(rateMetric(metric, 0)).toBe('good');
      expect(rateMetric(metric, good)).toBe('good');
      expect(rateMetric(metric, good + 0.001)).toBe('needs-improvement');
      expect(rateMetric(metric, poor)).toBe('needs-improvement');
      expect(rateMetric(metric, poor + 0.001)).toBe('poor');
    },
  );

  it('uses web-vitals thresholds', () => {
    expect(rateMetric('LCP', 2600)).toBe('needs-improvement');
    expect(rateMetric('INP', 600)).toBe('poor');
    expect(rateMetric('CLS', 0.05)).toBe('good');
  });
});
