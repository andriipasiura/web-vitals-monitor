import { rateMetric, type MetricName, type Rating } from '@rum/shared';
import { formatPercent, formatValue } from '@/lib/format';
import type { Shares } from '@/lib/types';
import { cn } from '@/lib/utils';

export const RATING_TEXT: Record<Rating, string> = {
  good: 'text-good',
  'needs-improvement': 'text-ni',
  poor: 'text-poor',
};

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Good',
  'needs-improvement': 'Needs improvement',
  poor: 'Poor',
};

export function MetricValue({
  metric,
  value,
  className,
}: {
  metric: MetricName;
  value: number | null | undefined;
  className?: string;
}) {
  const rating =
    value === null || value === undefined ? null : rateMetric(metric, value);
  return (
    <span
      className={cn('tabular-nums', rating && RATING_TEXT[rating], className)}
      title={rating ? RATING_LABEL[rating] : undefined}
    >
      {formatValue(metric, value)}
    </span>
  );
}

export function ShareBar({
  shares,
  className,
}: {
  shares: Shares | null;
  className?: string;
}) {
  if (!shares)
    return <div className={cn('h-1.5 rounded-full bg-zinc-100', className)} />;
  const label = `${formatPercent(shares.good)} good, ${formatPercent(shares.needsImprovement)} needs improvement, ${formatPercent(shares.poor)} poor`;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'flex h-1.5 gap-px overflow-hidden rounded-full bg-zinc-100',
        className,
      )}
    >
      <div className="bg-good" style={{ width: `${shares.good * 100}%` }} />
      <div
        className="bg-ni"
        style={{ width: `${shares.needsImprovement * 100}%` }}
      />
      <div className="bg-poor" style={{ width: `${shares.poor * 100}%` }} />
    </div>
  );
}
