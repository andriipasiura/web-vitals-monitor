'use client';

import { DEVICE_TYPES, METRIC_NAMES, PERCENTILES } from '@rum/shared';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PERIODS, useFilters, type Filters } from '@/lib/filters';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col gap-1">
      {label}
      {children}
    </Label>
  );
}

export function FilterBar({
  routes,
  showMetric = true,
}: {
  routes?: string[];
  showMetric?: boolean;
}) {
  const { filters, setFilters } = useFilters();
  const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
    setFilters({ [key]: event.target.value });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Period">
        <NativeSelect value={filters.period} onChange={set('period')}>
          {Object.keys(PERIODS).map((p) => (
            <option key={p} value={p}>
              Last {p}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {showMetric && (
        <Field label="Metric">
          <NativeSelect value={filters.metric} onChange={set('metric')}>
            {METRIC_NAMES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Percentile">
        <NativeSelect value={filters.percentile} onChange={set('percentile')}>
          {PERCENTILES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </NativeSelect>
      </Field>
      {routes && (
        <Field label="Route">
          <NativeSelect
            value={filters.route ?? ''}
            onChange={set('route')}
            className="max-w-56"
          >
            <option value="">All routes</option>
            {filters.route && !routes.includes(filters.route) && (
              <option>{filters.route}</option>
            )}
            {routes.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Device">
        <NativeSelect value={filters.device ?? ''} onChange={set('device')}>
          <option value="">All devices</option>
          {DEVICE_TYPES.map((d) => (
            <option key={d} value={d}>
              {d[0]!.toUpperCase() + d.slice(1)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Release">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('release');
            setFilters({ release: String(value ?? '').trim() });
          }}
        >
          <Input
            key={filters.release ?? ''}
            name="release"
            defaultValue={filters.release}
            placeholder="All releases"
            className="h-8 w-36 text-xs"
            onBlur={(event) => event.currentTarget.form?.requestSubmit()}
          />
        </form>
      </Field>
    </div>
  );
}
