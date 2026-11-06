'use client';

import { AUTH_LIMITS } from '@rum/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, setAccessToken } from '@/lib/api';

interface Credentials {
  email: string;
  password: string;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const register = mode === 'register';

  const submit = useMutation({
    mutationFn: async (input: Credentials) => {
      if (register) {
        await api('/v1/auth/register', {
          method: 'POST',
          body: input,
          auth: false,
        });
      }
      const session = await api<{ accessToken: string }>('/v1/auth/login', {
        method: 'POST',
        body: input,
        auth: false,
      });
      setAccessToken(session.accessToken);
    },
    onSuccess: () => router.replace('/projects'),
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold">
          {register ? 'Create an account' : 'Sign in'}
        </h1>
        <p className="mb-6 text-sm text-zinc-500">Web Vitals Monitor</p>
        <form
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            submit.mutate({
              email: String(data.get('email')),
              password: String(data.get('password')),
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={AUTH_LIMITS.maxEmailLength}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? AUTH_LIMITS.minPasswordLength : 1}
              maxLength={AUTH_LIMITS.maxPasswordLength}
              required
            />
          </div>
          {submit.error && (
            <p role="alert" className="text-sm text-poor">
              {submit.error.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {register ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          {register ? 'Already have an account? ' : 'No account yet? '}
          <Link
            href={register ? '/login' : '/register'}
            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            {register ? 'Sign in' : 'Create one'}
          </Link>
        </p>
      </div>
    </main>
  );
}
