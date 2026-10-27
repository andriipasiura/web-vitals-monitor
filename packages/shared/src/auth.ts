import { z } from 'zod';

export const AUTH_LIMITS = {
  maxEmailLength: 254,
  minPasswordLength: 8,
  maxPasswordLength: 128,
} as const;

const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(AUTH_LIMITS.maxEmailLength)
  .pipe(z.email());

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(AUTH_LIMITS.minPasswordLength)
    .max(AUTH_LIMITS.maxPasswordLength),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(AUTH_LIMITS.maxPasswordLength),
});
export type LoginInput = z.infer<typeof LoginSchema>;
