'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, onUnauthorized } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (failures, error) =>
              !(error instanceof ApiError && error.status < 500) &&
              failures < 2,
          },
        },
      }),
  );

  useEffect(() => {
    onUnauthorized(() => {
      client.clear();
      router.replace('/login');
    });
  }, [client, router]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
