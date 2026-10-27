import { Inject, Injectable } from '@nestjs/common';
import { rateMetric, type WebVitalEvent } from '@rum/shared';
import {
  EVENTS_REPOSITORY,
  type EventsRepository,
  type StoredEvent,
} from './events.repository.js';
import { inferRouteTemplate } from './route-template.js';

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENTS_REPOSITORY) private readonly repository: EventsRepository,
  ) {}

  async ingest(
    projectId: string,
    events: readonly WebVitalEvent[],
  ): Promise<void> {
    const receivedAt = new Date();
    await this.repository.saveMany(
      events.map((event) => toStoredEvent(projectId, event, receivedAt)),
    );
  }
}

function toStoredEvent(
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
