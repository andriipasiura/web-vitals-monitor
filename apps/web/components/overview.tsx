'use client';

import {
  ANALYTICS_LIMITS,
  classifyChange,
  DEVICE_TYPES,
  relativeChange,
  type DeviceType,
} from '@rum/shared';
import Link from 'next/link';
import { Delta, MetricValue } from '@/components/rating';
import { Sparkline } from '@/components/sparkline';
import { Panel, QueryState, Skeleton } from '@/components/states';
import { toQuery, useFilters, type Filters } from '@/lib/filters';
import { formatChange, formatPercent, formatShortDate } from '@/lib/format';
import { useMetrics, useRoutes, type useReleases } from '@/lib/queries';
import type { Regression, RoutesResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

type ReleasesQuery = ReturnType<typeof useReleases>;

const routeHref = (projectId: string, filters: Filters, route: string) =>
  `/projects/${projectId}/route?${toQuery({ ...filters, release: undefined, route })}`;

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="text-xs text-muted hover:text-fg">
      {children}
    </Link>
  );
}

export function RegressionNote({ regression }: { regression: Regression }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-poor" />
      <span className="truncate">
        {regression.metric}{' '}
        {regression.change === null ? 'up' : formatChange(regression.change)} on{' '}
        <span className="font-mono">{regression.route}</span>
      </span>
    </span>
  );
}

export const isFlagged = (
  release: { release: string; metrics: Record<string, { status: string }> },
  regression: Regression | null,
  metrics: readonly string[],
) =>
  release.release === regression?.release ||
  metrics.some((m) => release.metrics[m]?.status === 'regressed');

export const FLAGGED_ROW = 'shadow-[inset_2px_0_0_var(--poor)]';

const rowClass =
  'grid items-center gap-3 border-b border-line px-4 py-2 last:border-0';

function RouteRow({
  projectId,
  filters,
  row,
}: {
  projectId: string;
  filters: Filters;
  row: RoutesResponse['routes'][number];
}) {
  const trend = useMetrics(projectId, filters.metric, {
    ...filters,
    route: row.route,
  });
  const before = { value: row.previousValue, count: row.previousCount };
  return (
    <li className={cn(rowClass, 'grid-cols-[minmax(0,1fr)_auto_5rem_3.5rem]')}>
      <Link
        href={routeHref(projectId, filters, row.route)}
        className="truncate font-mono text-xs hover:underline"
        title={row.route}
      >
        {row.route}
      </Link>
      {trend.data ? (
        <Sparkline values={trend.data.series.map((p) => p.value)} />
      ) : (
        <Skeleton className="h-5 w-[72px]" />
      )}
      <MetricValue
        metric={filters.metric}
        value={row.value}
        dot
        className="justify-end text-sm"
      />
      <Delta
        change={relativeChange(row.previousValue, row.value)}
        status={classifyChange(filters.metric, before, row)}
        className="justify-self-end"
      />
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function RoutesCard({
  projectId,
  filters,
  search,
}: {
  projectId: string;
  filters: Filters;
  search: string;
}) {
  const routes = useRoutes(projectId, filters, {
    minSamples: ANALYTICS_LIMITS.minRegressionSamples,
    limit: 5,
  });
  return (
    <Panel
      title="Routes needing attention"
      actions={
        <CardLink href={`/projects/${projectId}/routes?${search}`}>
          All routes
        </CardLink>
      }
    >
      <QueryState
        query={routes}
        loading={<ListSkeleton />}
        isEmpty={(data) => data.routes.length === 0}
        empty="No route has enough samples in this period."
      >
        {(data) => (
          <ul
            aria-label={`Slowest routes by ${filters.metric} ${filters.percentile}`}
          >
            {data.routes.map((row) => (
              <RouteRow
                key={row.route}
                projectId={projectId}
                filters={filters}
                row={row}
              />
            ))}
          </ul>
        )}
      </QueryState>
    </Panel>
  );
}

export function ReleasesCard({
  projectId,
  releases,
  search,
}: {
  projectId: string;
  releases: ReleasesQuery;
  search: string;
}) {
  const { setFilters } = useFilters();
  const grid = 'grid-cols-[minmax(0,1fr)_6.5rem_6.5rem]';
  return (
    <Panel
      title="Releases"
      actions={
        <CardLink href={`/projects/${projectId}/releases?${search}`}>
          All releases
        </CardLink>
      }
    >
      <QueryState
        query={releases}
        loading={<ListSkeleton />}
        isEmpty={(data) => data.releases.length === 0}
        empty="No releases in this period. Set data-release on the snippet."
      >
        {(data) => (
          <>
            <div
              aria-hidden
              className={cn(rowClass, grid, 'py-1.5 text-xs text-muted')}
            >
              <span>Release</span>
              <span className="text-right">LCP</span>
              <span className="text-right">INP</span>
            </div>
            <ul aria-label="Recent releases">
              {data.releases.slice(0, 5).map((release) => {
                const flagged = isFlagged(release, data.regression, [
                  'LCP',
                  'INP',
                ]);
                const note =
                  data.regression?.release === release.release
                    ? data.regression
                    : null;
                return (
                  <li
                    key={release.release}
                    className={cn(rowClass, grid, flagged && FLAGGED_ROW)}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({ release: release.release })
                          }
                          className="shrink-0 font-mono text-xs hover:underline"
                          title={`Show only ${release.release}`}
                        >
                          {release.release}
                        </button>
                        <span className="truncate text-xs whitespace-nowrap text-muted">
                          {formatShortDate(release.firstSeen)}
                        </span>
                      </span>
                      {note && <RegressionNote regression={note} />}
                    </span>
                    {(['LCP', 'INP'] as const).map((metric) => (
                      <span
                        key={metric}
                        className="flex items-center justify-end gap-1.5 text-sm"
                      >
                        <MetricValue
                          metric={metric}
                          value={release.metrics[metric].value}
                        />
                        <Delta
                          change={release.metrics[metric].change}
                          status={release.metrics[metric].status}
                        />
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </QueryState>
    </Panel>
  );
}

const DEVICE_LABEL: Record<DeviceType, string> = {
  mobile: 'Mobile',
  desktop: 'Desktop',
  tablet: 'Tablet',
};

export function DevicesCard({
  projectId,
  filters,
}: {
  projectId: string;
  filters: Filters;
}) {
  const mobile = useMetrics(projectId, filters.metric, {
    ...filters,
    device: 'mobile',
  });
  const desktop = useMetrics(projectId, filters.metric, {
    ...filters,
    device: 'desktop',
  });
  const tablet = useMetrics(projectId, filters.metric, {
    ...filters,
    device: 'tablet',
  });
  const queries = { mobile, desktop, tablet };
  const pending = DEVICE_TYPES.some((d) => queries[d].isPending);
  const total = DEVICE_TYPES.reduce(
    (sum, d) => sum + (queries[d].data?.summary.count ?? 0),
    0,
  );

  return (
    <Panel
      title="By device"
      actions={
        <span className="text-xs text-muted">
          {filters.metric} {filters.percentile}
        </span>
      }
    >
      {pending ? (
        <ListSkeleton />
      ) : total === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">
          No data in this period.
        </p>
      ) : (
        <ul aria-label="Split by device">
          {DEVICE_TYPES.map((device) => {
            const summary = queries[device].data?.summary;
            const share = (summary?.count ?? 0) / total;
            return (
              <li
                key={device}
                className={cn(
                  rowClass,
                  'grid-cols-[4.5rem_minmax(0,1fr)_2.5rem_5rem] py-3',
                )}
              >
                <span className="text-sm">{DEVICE_LABEL[device]}</span>
                <span
                  role="img"
                  aria-label={`${formatPercent(share)} of samples`}
                  className="h-1.5 overflow-hidden rounded-full bg-subtle"
                >
                  <span
                    className="block h-full rounded-full bg-faint"
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
                <span className="text-right text-xs text-muted tabular-nums">
                  {formatPercent(share)}
                </span>
                <MetricValue
                  metric={filters.metric}
                  value={summary?.value}
                  dot
                  className="justify-end text-sm"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
