'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { MetricValue, ShareBar } from '@/components/rating';
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
import { formatCount, formatPercent } from '@/lib/format';
import { useRoutes } from '@/lib/queries';
import { cn } from '@/lib/utils';

export default function RoutesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { filters } = useFilters();
  const routes = useRoutes(id, filters);
  const href = (route: string) =>
    `/projects/${id}/route?${toQuery({ ...filters, route })}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Routes">
        <FilterBar />
      </PageHeader>
      <Panel
        title={`Routes by ${filters.metric} ${filters.percentile}`}
        className={cn(routes.isPlaceholderData && 'opacity-60')}
      >
        <QueryState
          query={routes}
          isEmpty={(data) => data.routes.length === 0}
          empty="No routes in this period."
        >
          {(data) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">
                    {filters.percentile}
                  </TableHead>
                  <TableHead className="w-48">Good / NI / Poor</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.routes.map((row) => (
                  <TableRow
                    key={row.route}
                    className="cursor-pointer hover:bg-subtle"
                    onClick={() => router.push(href(row.route))}
                  >
                    <TableCell className="max-w-96 truncate font-mono text-xs">
                      <Link href={href(row.route)} className="hover:underline">
                        {row.route}
                      </Link>
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
                      {row.shares ? formatPercent(row.shares.good) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted">
                      {formatCount(row.count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}
