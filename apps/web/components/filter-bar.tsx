'use client';

import { DEVICE_TYPES, METRIC_NAMES, PERCENTILES } from '@rum/shared';
import { useParams } from 'next/navigation';
import { NativeSelect } from '@/components/ui/native-select';
import { Segmented } from '@/components/ui/segmented';
import { PERIODS, useFilters, type Filters, type Period } from '@/lib/filters';
import { useReleases } from '@/lib/queries';

const PERIOD_OPTIONS = (Object.keys(PERIODS) as Period[]).map((value) => ({
  value,
  label: value,
}));
const PERCENTILE_OPTIONS = PERCENTILES.map((value) => ({
  value,
  label: value,
}));

function ReleaseSelect({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (release: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const releases = useReleases(id, filters);
  const names = releases.data?.releases.map((r) => r.release) ?? [];
  return (
    <NativeSelect
      aria-label="Release"
      value={filters.release ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className="w-36"
    >
      <option value="">All releases</option>
      {filters.release && !names.includes(filters.release) && (
        <option>{filters.release}</option>
      )}
      {names.map((name) => (
        <option key={name}>{name}</option>
      ))}
    </NativeSelect>
  );
}

export function FilterBar({
  routes,
  showMetric = true,
  showRelease = true,
}: {
  routes?: string[];
  showMetric?: boolean;
  showRelease?: boolean;
}) {
  const { filters, setFilters } = useFilters();
  const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
    setFilters({ [key]: event.target.value });

  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className="flex flex-wrap items-center gap-2"
    >
      <Segmented
        label="Period"
        value={filters.period}
        options={PERIOD_OPTIONS}
        onChange={(period) => setFilters({ period })}
      />
      <Segmented
        label="Percentile"
        value={filters.percentile}
        options={PERCENTILE_OPTIONS}
        onChange={(percentile) => setFilters({ percentile })}
      />
      {showMetric && (
        <NativeSelect
          aria-label="Metric"
          value={filters.metric}
          onChange={set('metric')}
        >
          {METRIC_NAMES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </NativeSelect>
      )}
      {routes && (
        <NativeSelect
          aria-label="Route"
          value={filters.route ?? ''}
          onChange={set('route')}
          className="w-44"
        >
          <option value="">All routes</option>
          {filters.route && !routes.includes(filters.route) && (
            <option>{filters.route}</option>
          )}
          {routes.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        aria-label="Device"
        value={filters.device ?? ''}
        onChange={set('device')}
      >
        <option value="">All devices</option>
        {DEVICE_TYPES.map((d) => (
          <option key={d} value={d}>
            {d[0]!.toUpperCase() + d.slice(1)}
          </option>
        ))}
      </NativeSelect>
      {showRelease && (
        <ReleaseSelect
          filters={filters}
          onChange={(release) => setFilters({ release })}
        />
      )}
    </div>
  );
}
