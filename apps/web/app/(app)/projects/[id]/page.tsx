'use client';

import { METRIC_NAMES, rateMetric, type MetricName } from '@rum/shared';
import { useParams } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { MetricValue, RATING_LABEL, ShareBar } from '@/components/rating';
import { Panel, QueryState, Skeleton } from '@/components/states';
import { Trend } from '@/components/trend';
import { rangeOf, useFilters, type Filters } from '@/lib/filters';
import { formatPercent, formatSamples } from '@/lib/format';
import { useMetrics, useRoutes } from '@/lib/queries';
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
        'flex flex-col gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-zinc-300',
        selected ? 'border-accent ring-1 ring-accent' : 'border-zinc-200',
        query.isPlaceholderData && 'opacity-60',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{metric}</span>
        <span className="text-xs text-zinc-500">{filters.percentile}</span>
      </div>
      {query.isPending ? (
        <>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-4 w-20" />
        </>
      ) : query.error ? (
        <p className="text-sm text-poor">Failed to load</p>
      ) : summary && summary.count > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
            <MetricValue
              metric={metric}
              value={summary.value}
              className="text-3xl font-semibold tracking-tight"
            />
            {summary.value !== null && (
              <span className="text-xs text-zinc-500">
                {RATING_LABEL[rateMetric(metric, summary.value)]}
              </span>
            )}
          </div>
          <ShareBar shares={summary.shares} />
          <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
            <span>{formatPercent(summary.shares?.good ?? 0)} good</span>
            <span>{formatSamples(summary.count)}</span>
          </div>
        </>
      ) : (
        <p className="py-2 text-sm text-zinc-500">No data</p>
      )}
    </button>
  );
}

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, setFilters } = useFilters();
  const routes = useRoutes(id, filters);
  const trend = useMetrics(id, filters.metric, filters);

  return (
    <div className="space-y-6">
      <FilterBar
        showMetric={false}
        routes={routes.data?.routes.map((r) => r.route) ?? []}
      />
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
        className={cn(trend.isPlaceholderData && 'opacity-60')}
      >
        <div className="p-4">
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
                {...rangeOf(filters.period)}
              />
            )}
          </QueryState>
        </div>
      </Panel>
    </div>
  );
}
