import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, type Processor, Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  EVENTS_JOB_OPTIONS,
  EVENTS_QUEUE_NAME,
  type EventsJob,
} from '../events/events.queue.js';
import {
  closeRedis,
  createRedis,
  WORKER_CLIENT_OPTIONS,
} from '../redis/redis.js';
import { EventsProcessor } from './events.processor.js';
import {
  MAINTENANCE_QUEUE_NAME,
  MAINTENANCE_SCHEDULES,
  MaintenanceProcessor,
} from './maintenance.processor.js';

export const EVENTS_CONCURRENCY = 10;
export const SHUTDOWN_TIMEOUT_MS = 25_000;

interface RunningWorker {
  worker: Worker;
  connection: Redis;
}

@Injectable()
export class WorkersService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(WorkersService.name);
  private readonly running: RunningWorker[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventsProcessor,
    private readonly maintenance: MaintenanceProcessor,
  ) {}

  onApplicationBootstrap(): void {
    this.start<EventsJob>(
      EVENTS_QUEUE_NAME,
      (job) => this.events.process(job),
      EVENTS_CONCURRENCY,
    );
    this.start(
      MAINTENANCE_QUEUE_NAME,
      (job) => this.maintenance.process(job),
      1,
    );
  }

  async scheduleMaintenance(): Promise<void> {
    const connection = this.connect(MAINTENANCE_QUEUE_NAME);
    const queue = new Queue(MAINTENANCE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: EVENTS_JOB_OPTIONS.removeOnFail,
      },
    });
    try {
      for (const [name, every] of Object.entries(MAINTENANCE_SCHEDULES)) {
        await queue.upsertJobScheduler(name, { every }, { name });
      }
      await queue.add('partitions', {});
    } finally {
      await queue.close();
      await closeRedis(connection);
    }
  }

  private connect(name: string): Redis {
    return createRedis(
      this.config.getOrThrow<string>('REDIS_URL'),
      WORKER_CLIENT_OPTIONS,
      `worker:${name}`,
    );
  }

  private start<T>(
    name: string,
    processor: Processor<T>,
    concurrency: number,
  ): Worker<T> {
    const connection = this.connect(name);
    const worker = new Worker<T>(name, processor, { connection, concurrency });
    worker.on('failed', (job, err) => this.logFailure(name, job, err));
    worker.on('error', (err) =>
      this.logger.error(`Worker ${name} error: ${err.message}`),
    );
    this.running.push({ worker: worker as Worker, connection });
    return worker;
  }

  private logFailure(name: string, job: Job | undefined, err: Error): void {
    if (!job) return;
    const attempts = Math.max(job.opts.attempts ?? 1, 1);
    const reason = err.cause instanceof Error ? err.cause.message : err.message;
    const message = `${name} job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}): ${reason}`;
    if (job.attemptsMade >= attempts) {
      this.logger.error(`${message}. Kept in the failed set.`);
    } else {
      this.logger.warn(`${message}. Retrying.`);
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all(
      this.running.map(async ({ worker, connection }) => {
        let timer: NodeJS.Timeout | undefined;
        const timedOut = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS);
        });
        const closing = worker.close();
        const outcome = await Promise.race([closing, timedOut]);
        clearTimeout(timer);
        if (outcome === 'timeout') {
          this.logger.warn(
            `Worker ${worker.name} did not finish within ${SHUTDOWN_TIMEOUT_MS} ms, disconnecting`,
          );
          connection.disconnect();
          await closing.catch(() => undefined);
        }
        await closeRedis(connection);
      }),
    );
  }
}
