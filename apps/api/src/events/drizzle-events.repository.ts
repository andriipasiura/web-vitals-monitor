import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type Database } from '../db/database.js';
import { events } from '../db/schema.js';
import type { EventsRepository, StoredEvent } from './events.repository.js';

@Injectable()
export class DrizzleEventsRepository implements EventsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async saveMany(batch: readonly StoredEvent[]): Promise<void> {
    if (batch.length === 0) return;
    await this.db.insert(events).values(
      batch.map((event) => ({
        projectId: event.projectId,
        metric: event.metric,
        value: event.value,
        rating: event.rating,
        path: event.path,
        route: event.route,
        routeSource: event.routeSource,
        deviceType: event.deviceType,
        connectionType: event.connectionType,
        release: event.release,
        attribution: event.attribution,
        clientEventId: event.clientEventId,
        receivedAt: event.receivedAt,
      })),
    );
  }
}
