import { Pool } from 'pg';
import { inject } from 'vitest';

const databaseUrl = inject('databaseUrl');
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
process.env.DASHBOARD_ORIGIN = 'http://localhost:3000';

const pool = new Pool({ connectionString: databaseUrl });

beforeEach(async () => {
  await pool.query(
    'TRUNCATE users, refresh_tokens, projects, api_keys RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
