'use client';

import Link from 'next/link';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useMe, useProjects } from '@/lib/queries';
import {
  setThemePreference,
  useTheme,
  type ThemePreference,
} from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useLogout } from './session';

function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0">
      <rect width="24" height="24" rx="6" className="fill-fg" />
      <path
        d="M5 15.5h3l2-6 3.5 9 2-5.5H19"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-surface"
      />
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  Overview: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  Routes: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  Releases: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1" className="fill-current" />
    </>
  ),
  Settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function ProjectNavLinks({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const base = `/projects/${projectId}`;
  const query = new URLSearchParams(search.toString());
  query.delete('route');
  const keep = query.size ? `?${query}` : '';

  const items = [
    { href: `${base}${keep}`, label: 'Overview', active: pathname === base },
    {
      href: `${base}/routes${keep}`,
      label: 'Routes',
      active: pathname.startsWith(`${base}/route`),
    },
    {
      href: `${base}/releases${keep}`,
      label: 'Releases',
      active: pathname === `${base}/releases`,
    },
    {
      href: `${base}/settings`,
      label: 'Settings',
      active: pathname === `${base}/settings`,
    },
  ];

  return (
    <nav aria-label="Project" className="min-w-0 overflow-x-auto">
      <ul className="flex gap-0.5 lg:flex-col">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                item.active
                  ? 'bg-subtle font-medium text-fg'
                  : 'text-muted hover:bg-subtle hover:text-fg',
              )}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-4 shrink-0 fill-none stroke-current"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[item.label]}
              </svg>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ProjectSwitcher({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const projects = useProjects();
  return (
    <NativeSelect
      aria-label="Project"
      value={projectId ?? ''}
      onChange={(event) =>
        router.push(
          event.target.value ? `/projects/${event.target.value}` : '/projects',
        )
      }
      className="h-9 w-40 text-sm font-medium lg:w-full"
    >
      <option value="">All projects</option>
      {projectId && !projects.data && <option value={projectId}>…</option>}
      {projects.data?.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </NativeSelect>
  );
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function UserMenu() {
  const me = useMe();
  const logout = useLogout();
  const { preference } = useTheme();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const email = me.data?.email;

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const place = (event: Event) => {
      if ((event as ToggleEvent).newState !== 'open' || !trigger.current)
        return;
      const rect = trigger.current.getBoundingClientRect();
      const inSidebar = matchMedia('(min-width: 64rem)').matches;
      Object.assign(
        el.style,
        inSidebar
          ? {
              left: `${rect.left}px`,
              right: 'auto',
              top: 'auto',
              bottom: `${innerHeight - rect.top + 6}px`,
            }
          : {
              left: 'auto',
              right: `${innerWidth - rect.right}px`,
              top: `${rect.bottom + 6}px`,
              bottom: 'auto',
            },
      );
    };
    el.addEventListener('beforetoggle', place);
    return () => el.removeEventListener('beforetoggle', place);
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget="user-menu"
        className="flex w-full min-w-0 items-center gap-2 rounded-md p-1.5 text-left text-sm text-muted transition-colors outline-none hover:bg-subtle hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-xs font-medium text-fg uppercase"
        >
          {email?.[0] ?? '·'}
        </span>
        <span className="sr-only">Account menu</span>
        <span className="truncate max-lg:hidden">{email ?? ' '}</span>
      </button>
      <div
        ref={menu}
        id="user-menu"
        popover="auto"
        className="fixed m-0 w-60 rounded-lg border border-line bg-surface p-1 text-sm text-fg shadow-lg"
      >
        <p className="truncate px-2 pt-1.5 pb-2 text-xs text-muted">
          {email ?? 'Signed in'}
        </p>
        <div className="border-t border-line px-2 py-2">
          <p id="theme-label" className="mb-1.5 text-xs text-muted">
            Theme
          </p>
          <div
            role="radiogroup"
            aria-labelledby="theme-label"
            className="grid grid-cols-3 gap-0.5 rounded-md bg-subtle p-0.5"
          >
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={preference === theme.value}
                onClick={() => setThemePreference(theme.value)}
                className={cn(
                  'rounded px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  preference === theme.value
                    ? 'bg-surface font-medium text-fg shadow-sm'
                    : 'text-muted hover:text-fg',
                )}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-line pt-1">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md px-2 py-1.5 text-left text-muted transition-colors outline-none hover:bg-subtle hover:text-fg focus-visible:bg-subtle"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const { id } = useParams<{ id?: string }>();
  return (
    <aside className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:flex-col lg:items-stretch lg:gap-4 lg:border-r lg:border-b-0 lg:px-3 lg:py-4">
      <Link
        href="/projects"
        className="flex items-center gap-2 rounded-md text-sm font-semibold lg:px-1"
      >
        <LogoMark />
        <span className="whitespace-nowrap max-lg:sr-only">Web Vitals</span>
      </Link>
      <ProjectSwitcher projectId={id} />
      {id && <ProjectNavLinks projectId={id} />}
      <div className="ml-auto lg:mt-auto lg:ml-0">
        <UserMenu />
      </div>
    </aside>
  );
}
