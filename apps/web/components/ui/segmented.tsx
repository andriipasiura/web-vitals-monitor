import { useId } from 'react';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-8 items-center rounded-md border border-line bg-surface p-0.5"
    >
      {options.map((option) => (
        <label key={option.value} className="h-full">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex h-full cursor-pointer items-center rounded px-2.5 text-xs text-muted tabular-nums transition-colors select-none hover:text-fg',
              'peer-checked:bg-subtle peer-checked:font-medium peer-checked:text-fg',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40',
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
