import { sql } from 'drizzle-orm';
import type { Database } from './database.js';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const ADVISORY_LOCKS = {
  partitions: 7_300_001,
  rollups: 7_300_002,
} as const;

export type LockResult<T> = { acquired: false } | { acquired: true; result: T };

export function withAdvisoryXactLock<T>(
  db: Database,
  key: number,
  fn: (tx: Transaction) => Promise<T>,
): Promise<LockResult<T>> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ acquired: boolean }>(
      sql`select pg_try_advisory_xact_lock(${key}) as acquired`,
    );
    if (!rows[0]?.acquired) return { acquired: false };
    return { acquired: true, result: await fn(tx) };
  });
}
