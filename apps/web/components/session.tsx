'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api, hasSession, refreshSession, setAccessToken } from '@/lib/api';
import { ErrorState, Loading } from './states';

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => hasSession() || refreshSession(),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (session.data === false) router.replace('/login');
  }, [session.data, router]);

  if (session.error) {
    return (
      <ErrorState error={session.error} onRetry={() => session.refetch()} />
    );
  }
  if (!session.data) return <Loading />;
  return children;
}

export function useLogout() {
  const router = useRouter();
  const client = useQueryClient();
  return async () => {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    client.clear();
    router.replace('/login');
  };
}
