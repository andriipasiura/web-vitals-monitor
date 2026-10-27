import { z } from 'zod';

export const PROJECT_LIMITS = {
  maxNameLength: 100,
  maxAllowedOrigins: 20,
} as const;

export const OriginSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/, abort: true }))
  .refine(
    (value) => {
      const url = new URL(value);
      return url.href === `${url.origin}/`;
    },
    { error: 'Must be an origin without path, query, fragment or credentials' },
  )
  .transform((value) => new URL(value).origin);

const AllowedOriginsSchema = z
  .array(OriginSchema)
  .max(PROJECT_LIMITS.maxAllowedOrigins)
  .transform((origins) => [...new Set(origins)]);

const ProjectNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PROJECT_LIMITS.maxNameLength);

export const CreateProjectSchema = z.object({
  name: ProjectNameSchema,
  allowedOrigins: AllowedOriginsSchema.default([]),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: ProjectNameSchema.optional(),
    allowedOrigins: AllowedOriginsSchema.optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.allowedOrigins !== undefined,
    { error: 'Provide at least one field to update' },
  );
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
