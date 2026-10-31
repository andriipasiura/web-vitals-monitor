import { OriginSchema } from '@rum/shared';
import { z } from 'zod';

const TrustProxySchema = z
  .string()
  .trim()
  .min(1)
  .transform((value): boolean | number | string => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return /^\d+$/.test(value) ? Number(value) : value;
  });

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  JWT_SECRET: z.string().min(32),
  DASHBOARD_ORIGIN: OriginSchema,
  COOKIE_SECURE: z.stringbool().default(true),
  TRUST_PROXY: TrustProxySchema.optional(),
  RATE_LIMITS_ENABLED: z.stringbool().default(true),
});

export type Env = z.infer<typeof EnvSchema>;

export const WorkerEnvSchema = EnvSchema.pick({
  DATABASE_URL: true,
  REDIS_URL: true,
});

function validateWith<T extends z.ZodType>(schema: T) {
  return (config: Record<string, unknown>): z.infer<T> => {
    const result = schema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid env:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
  };
}

export const validateEnv = validateWith(EnvSchema);
export const validateWorkerEnv = validateWith(WorkerEnvSchema);
