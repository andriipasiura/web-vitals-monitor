import type { WebVitalEvent } from '@rum/shared';
import { type JobsOptions, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { closeRedis } from '../redis/redis.js';

export const EVENTS_QUEUE_NAME = 'events';

export interface EventsJob {
  projectId: string;
  receivedAt: string;
  events: WebVitalEvent[];
}

const DAY_SECONDS = 24 * 60 * 60;

export const EVENTS_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * DAY_SECONDS },
};

export class EventsQueue {
  readonly queue: Queue<EventsJob>;

  constructor(private readonly client: Redis) {
    this.queue = new Queue<EventsJob>(EVENTS_QUEUE_NAME, {
      connection: client,
      defaultJobOptions: EVENTS_JOB_OPTIONS,
    });
    this.queue.on('error', () => undefined);
  }

  async add(job: EventsJob): Promise<void> {
    if (this.client.status !== 'ready') {
      throw new Error(`Redis connection is ${this.client.status}`);
    }
    await this.queue.add('ingest', job);
  }

  async close(): Promise<void> {
    await this.queue.close();
    await closeRedis(this.client);
  }
}
