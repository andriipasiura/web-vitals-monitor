'use client';

import type { MetricName } from '@rum/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { MetricValue, ShareBar } from '@/components/rating';
import { Empty, Panel, QueryState, Skeleton } from '@/components/states';
import { Trend } from '@/components/trend';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { rangeOf, toQuery, useFilters, type Filters } from '@/lib/filters';
import { formatCount, formatSamples } from '@/lib/format';
import { useAttribution, useMetrics, usePaths } from '@/lib/queries';
import type { Target } from '@/lib/types';
import { cn } from '@/lib/utils';

function Paths({
  projectId,
  route,
  filters,
}: {
  projectId: string;
  route: string;
  filters: Filters;
}) {
  const paths = usePaths(projectId, route, filters);
  return (
    <Panel
      title={`Slowest paths by ${filters.metric} ${filters.percentile}`}
      actions={<span className="text-xs text-muted">Last 7 days</span>}
    >
      <QueryState
        query={paths}
        isEmpty={(data) => data.pages[0]!.paths.length === 0}
        empty="No paths in the last 7 days."
      >
        {(data) => (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">
                    {filters.percentile}
                  </TableHead>
                  <TableHead className="w-40">Good / NI / Poor</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages
                  .flatMap((page) => page.paths)
                  .map((row) => (
                    <TableRow key={row.path}>
                      <TableCell className="max-w-96 truncate font-mono text-xs">
                        {row.path}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <MetricValue
                          metric={filters.metric}
                          value={row.value}
                          dot
                        />
                      </TableCell>
                      <TableCell>
                        <ShareBar shares={row.shares} />
                      </TableCell>
                      <TableCell className="text-right text-muted">
                        {formatCount(row.count)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {paths.hasNextPage && (
              <div className="border-t border-line p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paths.isFetchingNextPage}
                  onClick={() => paths.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </QueryState>
    </Panel>
  );
}

function Targets({
  title,
  metric,
  rows,
}: {
  title: string;
  metric: MetricName;
  rows: Target[];
}) {
  return (
    <Panel
      title={title}
      actions={<span className="text-xs text-muted">Last 7 days</span>}
    >
      {rows.length === 0 ? (
        <Empty>No {metric} attribution in the last 7 days.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Element</TableHead>
              <TableHead className="text-right">p75</TableHead>
              <TableHead className="text-right">Samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.target}>
                <TableCell
                  className="max-w-72 truncate font-mono text-xs"
                  title={row.target}
                >
                  {row.target}
                </TableCell>
                <TableCell className="text-right font-medium">
                  <MetricValue metric={metric} value={row.p75} dot />
                </TableCell>
                <TableCell className="text-right text-muted">
                  {formatCount(row.count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

function RouteDetails({
  projectId,
  route,
  filters,
}: {
  projectId: string;
  route: string;
  filters: Filters;
}) {
  const trend = useMetrics(projectId, filters.metric, filters);
  const attribution = useAttribution(projectId, route, filters);

  return (
    <>
      <Panel
        title={`${filters.metric} ${filters.percentile} over time`}
        className={cn(trend.isPlaceholderData && 'opacity-60')}
        actions={
          trend.data?.summary.count ? (
            <span className="flex items-baseline gap-3 text-xs text-muted tabular-nums">
              <MetricValue
                metric={filters.metric}
                value={trend.data.summary.value}
                dot
                className="text-lg font-semibold text-fg"
              />
              {formatSamples(trend.data.summary.count)}
            </span>
          ) : undefined
        }
      >
        <div className="p-4">
          <QueryState
            query={trend}
            loading={<Skeleton className="h-60 w-full" />}
            isEmpty={(data) => data.summary.count === 0}
            empty="No events for this route in this period."
          >
            {(data) => (
              <Trend
                metric={data.metric}
                points={data.series}
                from={rangeOf(filters.period).from}
                label={route}
              />
            )}
          </QueryState>
        </div>
      </Panel>
      <Paths projectId={projectId} route={route} filters={filters} />
      <QueryState query={attribution}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Targets
              title="Top LCP elements"
              metric="LCP"
              rows={data.lcpElements}
            />
            <Targets
              title="Slowest INP targets"
              metric="INP"
              rows={data.inpTargets}
            />
          </div>
        )}
      </QueryState>
    </>
  );
}

export default function RoutePage() {
  const { id } = useParams<{ id: string }>();
  const { filters } = useFilters();
  const { route, ...rest } = filters;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/projects/${id}/routes?${toQuery(rest)}`}
          className="text-muted hover:text-fg"
        >
          Routes
        </Link>
        <span aria-hidden className="text-faint">
          /
        </span>
        <h1 className="truncate font-mono font-medium">
          {route ?? 'Unknown route'}
        </h1>
      </div>
      <FilterBar />
      {route ? (
        <RouteDetails projectId={id} route={route} filters={filters} />
      ) : (
        <Empty>Pick a route on the Routes tab.</Empty>
      )}
    </div>
  );
}
