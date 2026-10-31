import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { rateMetric, type WebVitalEvent } from '@rum/shared';
import { ApiException } from '../common/errors/api-exception.js';
import { EventsQueue } from './events.queue.js';
import {
  EVENTS_REPOSITORY,
  type EventsRepository,
  type StoredEvent,
} from './events.repository.js';
import { inferRouteTemplate } from './route-template.js';

const WARN_INTERVAL_MS = 10_000;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private lastWarnedAt = 0;

  constructor(
    private readonly queue: EventsQueue,
    @Inject(EVENTS_REPOSITORY) private readonly repository: EventsRepository,
  ) {}

  async ingest(
    projectId: string,
    events: readonly WebVitalEvent[],
  ): Promise<void> {
    const receivedAt = new Date();
    try {
      await this.queue.add({
        projectId,
        receivedAt: receivedAt.toISOString(),
        events: [...events],
      });
      return;
    } catch (err) {
      this.warnFallback(err);
    }

    try {
      await this.repository.saveMany(
        events.map((event) => toStoredEvent(projectId, event, receivedAt)),
      );
    } catch (err) {
      this.logger.error(
        'Fallback insert failed, rejecting batch',
        err instanceof Error ? err.stack : String(err),
      );
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'INGESTION_UNAVAILABLE',
        'Events could not be accepted, retry later',
      );
    }
  }

  private warnFallback(err: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnedAt < WARN_INTERVAL_MS) return;
    this.lastWarnedAt = now;
    this.logger.warn(
      `Enqueue failed, inserting into Postgres directly: ${String(err)}`,
    );
  }
}

export function toStoredEvent(
  projectId: string,
  event: WebVitalEvent,
  receivedAt: Date,
): StoredEvent {
  return {
    ...event,
    projectId,
    route: event.route ?? inferRouteTemplate(event.path),
    routeSource: event.route ? 'sdk' : 'server',
    rating: rateMetric(event.metric, event.value),
    receivedAt,
  };
}
