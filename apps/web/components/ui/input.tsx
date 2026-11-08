import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full min-w-0 rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-faint focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:opacity-50 aria-invalid:border-poor';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(fieldClass, 'h-9', className)}
      {...props}
    />
  );
}
