'use client';

import { PROJECT_LIMITS } from '@rum/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader, Panel, QueryState } from '@/components/states';
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
import { API_URL, api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { parseOrigins } from '@/lib/origins';
import { useKeys, useProject } from '@/lib/queries';
import type { CreatedApiKey, Project } from '@/lib/types';

function ProjectForm({ project }: { project: Project }) {
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: (input: { name: string; allowedOrigins: string[] }) =>
      api<Project>(`/v1/projects/${project.id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (updated) => {
      client.setQueryData(['projects', project.id], updated);
      return client.invalidateQueries({
        queryKey: ['projects'],
        exact: true,
      });
    },
  });

  return (
    <form
      key={project.updatedAt}
      className="space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update.mutate({
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
          defaultValue={project.name}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="origins">Allowed origins, one per line</Label>
        <Textarea
          id="origins"
          name="origins"
          rows={4}
          placeholder="https://example.com"
          defaultValue={project.allowedOrigins.join('\n')}
        />
        <p className="text-xs text-muted">
          Events are accepted only from these origins, up to{' '}
          {PROJECT_LIMITS.maxAllowedOrigins}.
        </p>
      </div>
      {project.allowedOrigins.length === 0 && (
        <p className="text-sm text-ni">
          No origins yet: every event is rejected until you add your site.
        </p>
      )}
      {update.error && (
        <p role="alert" className="text-sm text-poor">
          {update.error.message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending}>
          Save
        </Button>
        {update.isSuccess && (
          <span role="status" className="text-sm text-muted">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Snippet({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${window.location.origin}/rum.js" data-key="${apiKey}" data-endpoint="${API_URL}" defer></script>`;
  return (
    <div className="space-y-3 border-b border-line bg-subtle p-4">
      <p className="text-sm">
        Copy the key now: it is shown only once. Add this tag to every page of
        your site.
      </p>
      <pre className="rounded-md break-all whitespace-pre-wrap border border-line bg-surface p-3 font-mono text-xs">
        {snippet}
      </pre>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy snippet'}
      </Button>
    </div>
  );
}

function Keys({ projectId }: { projectId: string }) {
  const keys = useKeys(projectId);
  const client = useQueryClient();
  const queryKey = ['projects', projectId, 'keys'];
  const create = useMutation({
    mutationFn: () =>
      api<CreatedApiKey>(`/v1/projects/${projectId}/keys`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  const revoke = useMutation({
    mutationFn: (keyId: string) =>
      api(`/v1/projects/${projectId}/keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  const error = create.error ?? revoke.error;

  return (
    <Panel
      title="Ingestion keys"
      actions={
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          Create key
        </Button>
      }
    >
      {create.data && <Snippet apiKey={create.data.key} />}
      {error && (
        <p role="alert" className="px-4 pt-3 text-sm text-poor">
          {error.message}
        </p>
      )}
      <QueryState
        query={keys}
        isEmpty={(data) => data.length === 0}
        empty="No keys yet."
      >
        {(data) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-xs">
                    {key.prefix}…
                  </TableCell>
                  <TableCell className="text-muted">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell>
                    {key.revokedAt ? (
                      <span className="text-faint">
                        Revoked {formatDate(key.revokedAt)}
                      </span>
                    ) : (
                      'Active'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!key.revokedAt && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revoke.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Revoke ${key.prefix}…? Sites using it stop reporting.`,
                            )
                          ) {
                            revoke.mutate(key.id);
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
    </Panel>
  );
}

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const project = useProject(id);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel title="Project" className="self-start">
          <QueryState query={project}>
            {(data) => <ProjectForm project={data} />}
          </QueryState>
        </Panel>
        <Keys projectId={id} />
      </div>
    </div>
  );
}
