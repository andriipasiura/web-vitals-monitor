'use client';

import type { MetricName } from '@rum/shared';
import { useInfiniteQuery, useQuery, type Query } from '@tanstack/react-query';
import { api } from './api';
import { rangeOf, toQuery, type Filters } from './filters';
import type {
  ApiKey,
  AttributionResponse,
  Me,
  MetricsResponse,
  PathsResponse,
  Project,
  ReleasesResponse,
  RoutesResponse,
} from './types';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/v1/auth/me'),
    staleTime: Infinity,
  });

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/v1/projects'),
  });

export const useProject = (id: string) =>
  useQuery({
    queryKey: ['projects', id],
    queryFn: () => api<Project>(`/v1/projects/${id}`),
  });

export const useKeys = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'keys'],
    queryFn: () => api<ApiKey[]>(`/v1/projects/${projectId}/keys`),
  });

const sameProject =
  (projectId: string) =>
  <T>(
    previous: T | undefined,
    query?: Query<T, Error, T, readonly unknown[]>,
  ) =>
    query?.queryKey[1] === projectId ? previous : undefined;

const segmentFilters = (filters: Filters) => ({
  percentile: filters.percentile,
  device_type: filters.device,
  release: filters.release,
});

export function useMetrics(
  projectId: string,
  metric: MetricName,
  filters: Filters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const query = toQuery({
    metric,
    ...rangeOf(filters.period),
    route: filters.route,
    ...segmentFilters(filters),
  });
  return useQuery({
    queryKey: ['metrics', projectId, query],
    enabled,
    placeholderData: sameProject(projectId),
    queryFn: () =>
      api<MetricsResponse>(`/v1/projects/${projectId}/metrics?${query}`),
  });
}

export function useRoutes(
  projectId: string,
  filters: Filters,
  { minSamples, limit }: { minSamples?: number; limit?: number } = {},
) {
  const { from, to } = rangeOf(filters.period);
  const query = toQuery({
    metric: filters.metric,
    from,
    to,
    ...segmentFilters(filters),
    min_samples: minSamples,
    limit,
  });
  return useQuery({
    queryKey: ['routes', projectId, query],
    placeholderData: sameProject(projectId),
    queryFn: () =>
      api<RoutesResponse>(`/v1/projects/${projectId}/routes?${query}`),
  });
}

export function usePaths(projectId: string, route: string, filters: Filters) {
  const query = toQuery({
    metric: filters.metric,
    route,
    ...segmentFilters(filters),
  });
  return useInfiniteQuery({
    queryKey: ['paths', projectId, query],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<PathsResponse>(
        `/v1/projects/${projectId}/routes/paths?${query}${pageParam ? `&${toQuery({ cursor: pageParam })}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAttribution(
  projectId: string,
  route: string,
  filters: Filters,
) {
  const query = toQuery({
    route,
    device_type: filters.device,
    release: filters.release,
  });
  return useQuery({
    queryKey: ['attribution', projectId, query],
    queryFn: () =>
      api<AttributionResponse>(
        `/v1/projects/${projectId}/routes/attribution?${query}`,
      ),
  });
}

export function useReleases(projectId: string, filters: Filters) {
  const { from, to } = rangeOf(filters.period);
  const query = toQuery({
    from,
    to,
    percentile: filters.percentile,
    device_type: filters.device,
  });
  return useQuery({
    queryKey: ['releases', projectId, query],
    placeholderData: sameProject(projectId),
    queryFn: () =>
      api<ReleasesResponse>(`/v1/projects/${projectId}/releases?${query}`),
  });
}
