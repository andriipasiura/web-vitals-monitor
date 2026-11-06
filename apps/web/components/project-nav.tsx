'use client';

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useProject } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Skeleton } from './states';

export function ProjectNav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const search = useSearchParams();
  const project = useProject(id);
  const base = `/projects/${id}`;
  const query = new URLSearchParams(search.toString());
  query.delete('route');
  const keep = query.size ? `?${query}` : '';

  const tabs = [
    { href: base, label: 'Overview', active: pathname === base },
    {
      href: `${base}/routes`,
      label: 'Routes',
      active: pathname.startsWith(`${base}/route`),
    },
    {
      href: `${base}/settings`,
      label: 'Settings',
      active: pathname === `${base}/settings`,
    },
  ];

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/projects" className="hover:text-zinc-900">
          Projects
        </Link>
        <span aria-hidden>/</span>
        {project.data ? (
          <span className="font-medium text-zinc-900">{project.data.name}</span>
        ) : (
          <Skeleton className="h-4 w-32" />
        )}
      </div>
      <nav className="flex gap-1 border-b border-zinc-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={
              tab.href === `${base}/settings` ? tab.href : `${tab.href}${keep}`
            }
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900',
              tab.active
                ? 'border-zinc-900 font-medium text-zinc-900'
                : 'border-transparent',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
