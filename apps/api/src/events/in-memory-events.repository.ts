import { Injectable } from '@nestjs/common';
import type { EventsRepository, StoredEvent } from './events.repository.js';

@Injectable()
export class InMemoryEventsRepository implements EventsRepository {
  private readonly events = new Map<string, StoredEvent>();

  saveMany(events: readonly StoredEvent[]): Promise<void> {
    for (const event of events) {
      if (!this.events.has(event.clientEventId)) {
        this.events.set(event.clientEventId, event);
      }
    }
    return Promise.resolve();
  }

  all(): StoredEvent[] {
    return [...this.events.values()];
  }
}
