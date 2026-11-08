import { SessionGate } from '@/components/session';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <SessionGate>
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-8">{children}</main>
      </div>
    </SessionGate>
  );
}
