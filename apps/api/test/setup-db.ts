import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { inject } from 'vitest';

const databaseUrl = inject('databaseUrl');
const redisUrl = inject('redisUrl');
process.env.DATABASE_URL = databaseUrl;
process.env.REDIS_URL = redisUrl;
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
process.env.DASHBOARD_ORIGIN = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'true';
process.env.TRUST_PROXY = 'false';
process.env.RATE_LIMITS_ENABLED = 'true';

const pool = new Pool({ connectionString: databaseUrl });
const redis = new Redis(redisUrl);

beforeEach(async () => {
  await Promise.all([
    pool.query(
      'TRUNCATE users, refresh_tokens, projects, api_keys, events, event_rollups_hourly RESTART IDENTITY CASCADE',
    ),
    redis.flushall(),
  ]);
});

afterAll(async () => {
  await Promise.all([pool.end(), redis.quit()]);
});
