'use client';

import { PROJECT_LIMITS } from '@rum/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Panel, QueryState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { parseOrigins } from '@/lib/origins';
import { useProjects } from '@/lib/queries';
import type { Project } from '@/lib/types';

export default function ProjectsPage() {
  const projects = useProjects();
  const client = useQueryClient();
  const router = useRouter();
  const create = useMutation({
    mutationFn: (input: { name: string; allowedOrigins: string[] }) =>
      api<Project>('/v1/projects', { method: 'POST', body: input }),
    onSuccess: async (project) => {
      await client.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${project.id}/settings`);
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel title="Projects">
        <QueryState
          query={projects}
          isEmpty={(data) => data.length === 0}
          empty="No projects yet. Create one to get an ingestion key."
        >
          {(data) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Allowed origins</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((project) => (
                  <TableRow key={project.id} className="hover:bg-zinc-50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-80 truncate text-zinc-500">
                      {project.allowedOrigins.join(', ') || 'None'}
                    </TableCell>
                    <TableCell className="text-right text-zinc-500">
                      {formatDate(project.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Panel>

      <Panel title="New project" className="self-start">
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            create.mutate({
              name: String(data.get('name')).trim(),
              allowedOrigins: parseOrigins(String(data.get('origins'))),
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={PROJECT_LIMITS.maxNameLength}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origins">Allowed origins, one per line</Label>
            <Textarea
              id="origins"
              name="origins"
              placeholder="https://example.com"
            />
          </div>
          {create.error && (
            <p role="alert" className="text-sm text-poor">
              {create.error.message}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            Create project
          </Button>
        </form>
      </Panel>
    </div>
  );
}
