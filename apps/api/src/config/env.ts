import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid env:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
