import type { MetricName } from '@rum/shared';

const count = new Intl.NumberFormat('en', { notation: 'compact' });
const percent = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function formatValue(
  metric: MetricName,
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'CLS') return value.toFixed(2);
  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`;
}

export const formatCount = (value: number) => count.format(value);
export const formatSamples = (value: number) =>
  `${count.format(value)} ${value === 1 ? 'sample' : 'samples'}`;
export const formatPercent = (value: number) => percent.format(value);
export const formatDate = (value: string) => date.format(new Date(value));
