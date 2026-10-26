import { Pool } from 'pg';
import { inject } from 'vitest';

const databaseUrl = inject('databaseUrl');
process.env.DATABASE_URL = databaseUrl;

const pool = new Pool({ connectionString: databaseUrl });

beforeEach(async () => {
  await pool.query(
    'TRUNCATE users, refresh_tokens, projects, api_keys RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
