import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import {
  ADVISORY_LOCKS,
  type LockResult,
  type Transaction,
  withAdvisoryXactLock,
} from '../db/advisory-lock.js';
import { DATABASE, type Database } from '../db/database.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const PARTITION_DAYS_AHEAD = 7;
export const PARTITION_RETENTION_DAYS = 30;

export interface PartitionChanges {
  created: string[];
  dropped: string[];
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);
}

export function partitionName(day: Date): string {
  return `events_p${day.toISOString().slice(0, 10).replaceAll('-', '')}`;
}

export async function createPartition(
  db: Database | Transaction,
  day: Date,
): Promise<void> {
  const from = startOfUtcDay(day);
  const to = new Date(from.getTime() + DAY_MS);
  await db.execute(
    sql.raw(
      `create table if not exists "${partitionName(from)}" partition of events ` +
        `for values from ('${from.toISOString()}') to ('${to.toISOString()}')`,
    ),
  );
}

@Injectable()
export class PartitionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PartitionsService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  onApplicationBootstrap(): Promise<void> {
    return this.runScheduled();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled(): Promise<void> {
    try {
      await this.maintain();
    } catch (err) {
      this.logger.error(`Partition maintenance failed: ${String(err)}`);
    }
  }

  async maintain(now = new Date()): Promise<LockResult<PartitionChanges>> {
    const outcome = await withAdvisoryXactLock(
      this.db,
      ADVISORY_LOCKS.partitions,
      (tx) => this.apply(tx, startOfUtcDay(now)),
    );
    if (!outcome.acquired) {
      this.logger.log('Partition maintenance skipped: lock held elsewhere');
    } else if (outcome.result.created.length || outcome.result.dropped.length) {
      this.logger.log(
        `Partitions created: [${outcome.result.created.join(', ')}], ` +
          `dropped: [${outcome.result.dropped.join(', ')}]`,
      );
    }
    return outcome;
  }

  private async apply(tx: Transaction, today: Date): Promise<PartitionChanges> {
    const { rows: existing } = await tx.execute<{
      name: string;
      upper: string;
    }>(sql`
      select c.relname as name,
        (regexp_match(pg_get_expr(c.relpartbound, c.oid), 'TO \\(''([^'']+)''\\)'))[1]::timestamptz as upper
      from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      where i.inhparent = 'events'::regclass
    `);
    const names = new Set(existing.map((partition) => partition.name));

    const created: string[] = [];
    for (let offset = 0; offset <= PARTITION_DAYS_AHEAD; offset++) {
      const day = new Date(today.getTime() + offset * DAY_MS);
      if (names.has(partitionName(day))) continue;
      await createPartition(tx, day);
      created.push(partitionName(day));
    }

    const cutoff = today.getTime() - PARTITION_RETENTION_DAYS * DAY_MS;
    const dropped: string[] = [];
    for (const partition of existing) {
      if (new Date(partition.upper).getTime() > cutoff) continue;
      await tx.execute(
        sql.raw(`drop table "${partition.name.replaceAll('"', '""')}"`),
      );
      dropped.push(partition.name);
    }
    return { created, dropped: dropped.sort() };
  }
}
