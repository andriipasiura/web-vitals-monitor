import { Inject, Injectable } from '@nestjs/common';
import type { WebVitalEvent } from '@rum/shared';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { EventsJob } from '../events/events.queue.js';
import {
  EVENTS_REPOSITORY,
  type EventsRepository,
} from '../events/events.repository.js';
import { toStoredEvent } from '../events/events.service.js';
import { REDIS } from '../redis/redis.js';

export const DEDUP_TTL_SECONDS = 48 * 60 * 60;

export const dedupKey = (projectId: string, clientEventId: string) =>
  `dedup:${projectId}:${clientEventId}`;

function uniqueByClientEventId(events: readonly WebVitalEvent[]) {
  const seen = new Set<string>();
  return events.filter(({ clientEventId }) => {
    if (seen.has(clientEventId)) return false;
    seen.add(clientEventId);
    return true;
  });
}

@Injectable()
export class EventsProcessor {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(EVENTS_REPOSITORY) private readonly repository: EventsRepository,
  ) {}

  async process(job: Job<EventsJob>): Promise<number> {
    const { projectId } = job.data;
    const owner = job.id!;
    const events = uniqueByClientEventId(job.data.events);
    const keys = events.map((event) =>
      dedupKey(projectId, event.clientEventId),
    );

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.call('SET', key, owner, 'EX', DEDUP_TTL_SECONDS, 'NX', 'GET');
    }
    const replies = (await pipeline.exec()) ?? [];
    const claimed = replies.map(([err, previous], i) => {
      if (err) throw err;
      return previous === null || previous === owner ? i : -1;
    });
    const fresh = claimed.filter((i) => i >= 0);
    if (fresh.length === 0) return 0;

    const receivedAt = new Date(job.data.receivedAt);
    try {
      await this.repository.saveMany(
        fresh.map((i) => toStoredEvent(projectId, events[i]!, receivedAt)),
      );
    } catch (err) {
      await this.redis.del(...fresh.map((i) => keys[i]!));
      throw err;
    }
    return fresh.length;
  }
}
