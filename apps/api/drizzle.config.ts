import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Nest, so this is the one place that reads
// process.env directly. Only `migrate` needs the URL; `generate` does not.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
