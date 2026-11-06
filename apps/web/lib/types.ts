import type { MetricName, Percentile } from '@rum/shared';

export interface Project {
  id: string;
  name: string;
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface Shares {
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface Totals {
  count: number;
  shares: Shares | null;
}

export interface MetricsResponse {
  metric: MetricName;
  percentile: Percentile;
  summary: Totals & { value: number | null };
  series: (Totals & { time: string; value: number | null })[];
}

export interface RoutesResponse {
  routes: (Totals & { route: string; value: number | null })[];
}

export interface PathsResponse {
  paths: (Totals & { path: string; value: number })[];
  nextCursor: string | null;
}

export interface Target {
  target: string;
  count: number;
  p75: number;
}

export interface AttributionResponse {
  lcpElements: Target[];
  inpTargets: Target[];
}
