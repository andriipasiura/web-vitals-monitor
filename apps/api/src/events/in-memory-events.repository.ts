import { Injectable } from '@nestjs/common';
import type { EventsRepository, StoredEvent } from './events.repository.js';

@Injectable()
export class InMemoryEventsRepository implements EventsRepository {
  private readonly events = new Map<string, StoredEvent>();

  saveMany(events: readonly StoredEvent[]): Promise<void> {
    for (const event of events) {
      const id = `${event.projectId}:${event.clientEventId}`;
      if (!this.events.has(id)) this.events.set(id, event);
    }
    return Promise.resolve();
  }

  all(): StoredEvent[] {
    return [...this.events.values()];
  }
}
