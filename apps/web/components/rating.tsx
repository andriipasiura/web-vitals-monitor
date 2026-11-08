import {
  rateMetric,
  type ChangeStatus,
  type MetricName,
  type Rating,
} from '@rum/shared';
import { formatChange, formatPercent, formatValue } from '@/lib/format';
import type { Shares } from '@/lib/types';
import { cn } from '@/lib/utils';

const RATING_BG: Record<Rating, string> = {
  good: 'bg-good',
  'needs-improvement': 'bg-ni',
  poor: 'bg-poor',
};

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Good',
  'needs-improvement': 'Needs improvement',
  poor: 'Poor',
};

const rate = (metric: MetricName, value: number | null | undefined) =>
  value === null || value === undefined ? null : rateMetric(metric, value);

export function MetricValue({
  metric,
  value,
  dot = false,
  className,
}: {
  metric: MetricName;
  value: number | null | undefined;
  dot?: boolean;
  className?: string;
}) {
  const rating = rate(metric, value);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 tabular-nums', className)}
    >
      {dot && rating && <RatingDot rating={rating} />}
      {formatValue(metric, value)}
    </span>
  );
}

export function RatingDot({ rating }: { rating: Rating }) {
  return (
    <span
      role="img"
      aria-label={RATING_LABEL[rating]}
      title={RATING_LABEL[rating]}
      className={cn('size-2 shrink-0 rounded-full', RATING_BG[rating])}
    />
  );
}

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', RATING_BG[rating])}
      />
      {RATING_LABEL[rating]}
    </span>
  );
}

const DELTA_TONE: Record<ChangeStatus, string> = {
  regressed: 'text-poor',
  improved: 'text-good',
  unchanged: 'text-muted',
};

export function Delta({
  change,
  status,
  className,
}: {
  change: number | null;
  status: ChangeStatus;
  className?: string;
}) {
  if (change === null) {
    return <span className={cn('text-xs text-muted', className)}>—</span>;
  }
  const up = change > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        DELTA_TONE[status],
        className,
      )}
      title={status === 'unchanged' ? 'Within noise' : `${status} vs previous`}
    >
      {change !== 0 && (
        <svg
          aria-hidden
          viewBox="0 0 8 8"
          className={cn('size-2 fill-current', !up && 'rotate-180')}
        >
          <path d="M4 1l3.5 5h-7z" />
        </svg>
      )}
      {formatChange(change)}
      {status !== 'unchanged' && <span className="sr-only">, {status}</span>}
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
    return <div className={cn('h-1.5 rounded-full bg-subtle', className)} />;
  const label = `${formatPercent(shares.good)} good, ${formatPercent(shares.needsImprovement)} needs improvement, ${formatPercent(shares.poor)} poor`;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'flex h-1.5 gap-px overflow-hidden rounded-full bg-subtle',
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
