import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-subtle', className)}
    />
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2 p-4">
      <Skeleton className={cn('h-5 w-full', className)} />
      <Skeleton className={cn('h-5 w-4/5', className)} />
      <Skeleton className={cn('h-5 w-3/5', className)} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm"
    >
      <p className="text-fg">{error.message || 'Something went wrong'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

interface QueryLike<T> {
  data: T | undefined;
  error: Error | null;
  isPending: boolean;
  refetch: () => unknown;
}

export function QueryState<T>({
  query,
  isEmpty,
  empty,
  loading,
  children,
}: {
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return loading ?? <Loading />;
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  const data = query.data as T;
  if (isEmpty?.(data)) return <Empty>{empty ?? 'No data yet.'}</Empty>;
  return children(data);
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-lg border border-line bg-surface', className)}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
