import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_LIMITS,
  type AttributionQuery,
  type MetricName,
  type MetricsQuery,
  type PathsQuery,
  PERCENTILE_FRACTIONS,
  percentileFromHistogram,
  type RoutesQuery,
} from '@rum/shared';
import { z } from 'zod';
import { QueryCache } from '../cache/query-cache.js';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  lcpElementsSql,
  metricsSeriesSql,
  type PathRow,
  type PathsCursor,
  routesSummarySql,
  type RouteRow,
  type SeriesRow,
  slowestInpTargetsSql,
  slowestPathsSql,
  type TargetRow,
  type TotalsRow,
} from './analytics.queries.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Shares {
  good: number;
  needsImprovement: number;
  poor: number;
}

interface Summary {
  value: number | null;
  count: number;
  shares: Shares | null;
}

function summarize(row: TotalsRow): { count: number; shares: Shares | null } {
  const count = Number(row.count);
  return {
    count,
    shares:
      count === 0
        ? null
        : {
            good: Number(row.good) / count,
            needsImprovement: Number(row.ni) / count,
            poor: Number(row.poor) / count,
          },
  };
}

function addInto(target: number[], buckets: readonly number[]): void {
  buckets.forEach((count, i) => (target[i] = (target[i] ?? 0) + count));
}

const CursorSchema = z.object({ value: z.number(), path: z.string() });

export function encodeCursor(cursor: PathsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(cursor: string): PathsCursor {
  try {
    return CursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
  } catch {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'INVALID_CURSOR',
      'Invalid pagination cursor',
    );
  }
}

const rawSince = (now: Date) =>
  new Date(now.getTime() - ANALYTICS_LIMITS.rawLookbackDays * DAY_MS);

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly projects: ProjectsService,
    private readonly cache: QueryCache,
  ) {}

  async metrics(ownerId: string, projectId: string, query: MetricsQuery) {
    await this.projects.get(ownerId, projectId);
    return this.cache.getOrLoad(
      this.cache.key('metrics', projectId, query),
      () => this.loadMetrics(projectId, query),
    );
  }

  async routes(ownerId: string, projectId: string, query: RoutesQuery) {
    await this.projects.get(ownerId, projectId);
    return this.cache.getOrLoad(
      this.cache.key('routes', projectId, query),
      () => this.loadRoutes(projectId, query),
    );
  }

  private async loadMetrics(projectId: string, query: MetricsQuery) {
    const fraction = PERCENTILE_FRACTIONS[query.percentile];
    const { rows } = await this.db.execute<SeriesRow>(
      metricsSeriesSql({ projectId, ...query }, query, query.granularity),
    );

    const total: number[] = [];
    const totals = { count: 0, good: 0, ni: 0, poor: 0 };
    const series = rows.map((row) => {
      const buckets = row.buckets.map(Number);
      addInto(total, buckets);
      totals.count += Number(row.count);
      totals.good += Number(row.good);
      totals.ni += Number(row.ni);
      totals.poor += Number(row.poor);
      return {
        time: new Date(row.time),
        value: percentileFromHistogram(query.metric, buckets, fraction),
        ...summarize(row),
      };
    });

    const summary: Summary = {
      value: totals.count
        ? percentileFromHistogram(query.metric, total, fraction)
        : null,
      ...summarize({
        count: String(totals.count),
        good: String(totals.good),
        ni: String(totals.ni),
        poor: String(totals.poor),
      }),
    };
    return {
      metric: query.metric,
      percentile: query.percentile,
      granularity: query.granularity,
      summary,
      series,
    };
  }

  private async loadRoutes(projectId: string, query: RoutesQuery) {
    const fraction = PERCENTILE_FRACTIONS[query.percentile];
    const { rows } = await this.db.execute<RouteRow>(
      routesSummarySql({ projectId, ...query }, query),
    );

    const routes = rows
      .map((row) => ({
        route: row.route,
        value: percentileFromHistogram(
          query.metric,
          row.buckets.map(Number),
          fraction,
        ),
        ...summarize(row),
      }))
      .sort(
        (a, b) =>
          (b.value ?? -1) - (a.value ?? -1) || a.route.localeCompare(b.route),
      )
      .slice(0, query.limit);
    return { metric: query.metric, percentile: query.percentile, routes };
  }

  async paths(
    ownerId: string,
    projectId: string,
    query: PathsQuery,
    now = new Date(),
  ) {
    await this.projects.get(ownerId, projectId);
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const { rows } = await this.db.execute<PathRow>(
      slowestPathsSql(
        { projectId, ...query },
        rawSince(now),
        PERCENTILE_FRACTIONS[query.percentile],
        query.limit,
        cursor,
      ),
    );

    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      metric: query.metric,
      percentile: query.percentile,
      route: query.route,
      paths: page.map((row) => ({
        path: row.path,
        value: row.value,
        ...summarize(row),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ value: last.value, path: last.path })
          : null,
    };
  }

  async attribution(
    ownerId: string,
    projectId: string,
    query: AttributionQuery,
    now = new Date(),
  ) {
    await this.projects.get(ownerId, projectId);
    const filters = { projectId, ...query };
    const since = rawSince(now);
    const [lcp, inp] = await Promise.all([
      this.db.execute<TargetRow>(lcpElementsSql(filters, since)),
      this.db.execute<TargetRow>(slowestInpTargetsSql(filters, since)),
    ]);
    const targets = (metric: MetricName, rows: TargetRow[]) =>
      rows.map((row) => ({
        metric,
        target: row.target,
        count: Number(row.count),
        p75: row.p75,
      }));
    return {
      route: query.route,
      lcpElements: targets('LCP', lcp.rows),
      inpTargets: targets('INP', inp.rows),
    };
  }
}
