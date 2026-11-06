import type { ReactNode } from 'react';
import { ProjectNav } from '@/components/project-nav';

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ProjectNav />
      {children}
    </>
  );
}
