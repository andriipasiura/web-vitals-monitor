'use client';

import { METRIC_NAMES, rateMetric, type MetricName } from '@rum/shared';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { FilterBar } from '@/components/filter-bar';
import { DevicesCard, ReleasesCard, RoutesCard } from '@/components/overview';
import { MetricValue, RatingBadge, ShareBar } from '@/components/rating';
import { PageHeader, Panel, QueryState, Skeleton } from '@/components/states';
import { Trend } from '@/components/trend';
import { rangeOf, useFilters, type Filters } from '@/lib/filters';
import { formatPercent, formatSamples } from '@/lib/format';
import { useMetrics, useReleases, useRoutes } from '@/lib/queries';
import { cn } from '@/lib/utils';

function MetricCard({
  projectId,
  metric,
  filters,
  selected,
  onSelect,
}: {
  projectId: string;
  metric: MetricName;
  filters: Filters;
  selected: boolean;
  onSelect: () => void;
}) {
  const query = useMetrics(projectId, metric, filters);
  const summary = query.data?.summary;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-faint',
        selected && 'shadow-[inset_0_2px_0_var(--accent)]',
        query.isPlaceholderData && 'opacity-60',
      )}
    >
      <span className="text-sm font-medium">{metric}</span>
      {query.isPending ? (
        <>
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-[22px] w-28" />
          <Skeleton className="mt-1 h-1.5 w-full" />
          <Skeleton className="h-4 w-full" />
        </>
      ) : query.error ? (
        <p className="text-sm text-poor">Failed to load</p>
      ) : summary && summary.count > 0 && summary.value !== null ? (
        <>
          <MetricValue
            metric={metric}
            value={summary.value}
            className="text-3xl font-semibold tracking-tight"
          />
          <span>
            <RatingBadge rating={rateMetric(metric, summary.value)} />
          </span>
          <ShareBar shares={summary.shares} className="mt-1" />
          <div className="flex justify-between text-xs text-muted tabular-nums">
            <span>{formatPercent(summary.shares?.good ?? 0)} good</span>
            <span>{formatSamples(summary.count)}</span>
          </div>
        </>
      ) : (
        <p className="py-2 text-sm text-muted">No data</p>
      )}
    </button>
  );
}

function LegendItem({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn('h-0.5 w-3 rounded-full', className)} />
      <span className="max-w-40 truncate">{label}</span>
    </span>
  );
}

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, setFilters, search } = useFilters();
  const routes = useRoutes(id, filters);
  const trend = useMetrics(id, filters.metric, filters);
  const releases = useReleases(id, filters);
  const range = rangeOf(filters.period);
  const regression = releases.data?.regression ?? null;

  const compareRoute = !filters.route ? regression?.route : undefined;
  const compare = useMetrics(
    id,
    filters.metric,
    { ...filters, route: compareRoute },
    { enabled: compareRoute !== undefined },
  );
  const secondary = useMemo(
    () =>
      compareRoute && compare.data
        ? { label: compareRoute, points: compare.data.series }
        : undefined,
    [compareRoute, compare.data],
  );
  const primaryLabel = filters.route ?? 'All routes';

  const markers = useMemo(
    () =>
      (releases.data?.releases ?? [])
        .filter((r) => r.firstSeen > range.from)
        .map((r) => ({
          time: r.firstSeen,
          label: r.release,
          highlight: r.release === regression?.release,
        })),
    [releases.data, range.from, regression],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Overview">
        <FilterBar
          showMetric={false}
          routes={routes.data?.routes.map((r) => r.route) ?? []}
        />
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {METRIC_NAMES.map((metric) => (
          <MetricCard
            key={metric}
            projectId={id}
            metric={metric}
            filters={filters}
            selected={metric === filters.metric}
            onSelect={() => setFilters({ metric })}
          />
        ))}
      </div>
      <Panel
        title={`${filters.metric} ${filters.percentile} over time`}
        actions={
          <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted">
            <LegendItem label={primaryLabel} className="bg-accent" />
            {secondary && (
              <LegendItem
                label={secondary.label}
                className="bg-faint font-mono"
              />
            )}
            {markers.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-3 border-l border-dashed border-faint"
                />
                Release
              </span>
            )}
          </span>
        }
        className={cn(trend.isPlaceholderData && 'opacity-60')}
      >
        <div className="px-4 pt-3 pb-2">
          <QueryState
            query={trend}
            loading={<Skeleton className="h-60 w-full" />}
            isEmpty={(data) => data.summary.count === 0}
            empty="No events in this period. Add the snippet from Settings to your site."
          >
            {(data) => (
              <Trend
                metric={data.metric}
                points={data.series}
                from={range.from}
                label={primaryLabel}
                secondary={secondary}
                markers={markers}
              />
            )}
          </QueryState>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <RoutesCard projectId={id} filters={filters} search={search} />
        <ReleasesCard projectId={id} releases={releases} search={search} />
        <DevicesCard projectId={id} filters={filters} />
      </div>
    </div>
  );
}
