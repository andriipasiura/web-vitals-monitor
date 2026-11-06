import Link from 'next/link';
import { LogoutButton, SessionGate } from '@/components/session';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <Link href="/projects" className="text-sm font-semibold">
            Web Vitals Monitor
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <SessionGate>{children}</SessionGate>
      </main>
    </>
  );
}
