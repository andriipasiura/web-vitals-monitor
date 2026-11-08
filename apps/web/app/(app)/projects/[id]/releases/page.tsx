'use client';

import { METRIC_NAMES } from '@rum/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { FLAGGED_ROW, isFlagged, RegressionNote } from '@/components/overview';
import { Delta, MetricValue } from '@/components/rating';
import { PageHeader, Panel, QueryState } from '@/components/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toQuery, useFilters } from '@/lib/filters';
import { formatCount, formatShortDate } from '@/lib/format';
import { useReleases } from '@/lib/queries';
import { cn } from '@/lib/utils';

export default function ReleasesPage() {
  const { id } = useParams<{ id: string }>();
  const { filters } = useFilters();
  const releases = useReleases(id, filters);

  return (
    <div className="space-y-4">
      <PageHeader title="Releases">
        <FilterBar showMetric={false} showRelease={false} />
      </PageHeader>
      <Panel
        title={`${filters.percentile} per release, change vs the previous release`}
        className={cn(releases.isPlaceholderData && 'opacity-60')}
      >
        <QueryState
          query={releases}
          isEmpty={(data) => data.releases.length === 0}
          empty="No releases in this period. Set data-release on the snippet to compare deploys."
        >
          {(data) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  {METRIC_NAMES.map((metric) => (
                    <TableHead key={metric} className="text-right">
                      {metric}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.releases.map((release) => {
                  const regressed = isFlagged(
                    release,
                    data.regression,
                    METRIC_NAMES,
                  );
                  const note =
                    data.regression?.release === release.release
                      ? data.regression
                      : null;
                  return (
                    <TableRow
                      key={release.release}
                      className={cn(regressed && FLAGGED_ROW)}
                    >
                      <TableCell className="font-mono text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              regressed ? 'bg-poor' : 'bg-transparent',
                            )}
                          />
                          <Link
                            href={`/projects/${id}?${toQuery({
                              period: filters.period,
                              percentile: filters.percentile,
                              device: filters.device,
                              release: release.release,
                            })}`}
                            className="hover:underline"
                          >
                            {release.release}
                          </Link>
                          {regressed && (
                            <span className="sr-only">(regression)</span>
                          )}
                        </span>
                        {note && (
                          <span className="mt-0.5 block pl-3.5 font-sans">
                            <RegressionNote regression={note} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted">
                        {formatShortDate(release.firstSeen)}
                      </TableCell>
                      <TableCell className="text-right text-muted">
                        {formatCount(release.count)}
                      </TableCell>
                      {METRIC_NAMES.map((metric) => {
                        const cell = release.metrics[metric];
                        return (
                          <TableCell key={metric}>
                            <span className="flex items-center justify-end gap-2">
                              <MetricValue
                                metric={metric}
                                value={cell.value}
                                dot
                              />
                              <Delta
                                change={cell.change}
                                status={cell.status}
                                className="min-w-12 justify-end"
                              />
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}
