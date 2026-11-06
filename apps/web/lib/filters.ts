'use client';

import {
  DEVICE_TYPES,
  METRIC_NAMES,
  PERCENTILES,
  type DeviceType,
  type Granularity,
  type MetricName,
  type Percentile,
} from '@rum/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export const PERIODS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as const;
export type Period = keyof typeof PERIODS;

export interface Filters {
  metric: MetricName;
  period: Period;
  percentile: Percentile;
  route?: string;
  device?: DeviceType;
  release?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function pick<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export function parseFilters(params: URLSearchParams): Filters {
  const device = params.get('device');
  return {
    metric: pick(params.get('metric'), METRIC_NAMES, 'LCP'),
    period: pick(params.get('period'), Object.keys(PERIODS) as Period[], '7d'),
    percentile: pick(params.get('percentile'), PERCENTILES, 'p75'),
    route: params.get('route') || undefined,
    device: DEVICE_TYPES.includes(device as DeviceType)
      ? (device as DeviceType)
      : undefined,
    release: params.get('release') || undefined,
  };
}

export function rangeOf(period: Period, now = Date.now()) {
  const to = Math.ceil(now / HOUR_MS) * HOUR_MS;
  const days = PERIODS[period];
  return {
    from: new Date(to - days * DAY_MS).toISOString(),
    to: new Date(to).toISOString(),
    granularity: (days > 7 ? 'day' : 'hour') as Granularity,
  };
}

export function toQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

export function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = parseFilters(new URLSearchParams(params.toString()));

  const setFilters = (patch: Partial<Filters>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return { filters, setFilters, search: params.toString() };
}
