'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './states';

export const Trend = dynamic(() => import('./trend-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full" />,
});
