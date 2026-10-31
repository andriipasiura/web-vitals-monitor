import { Module } from '@nestjs/common';
import { DrizzleEventsRepository } from './drizzle-events.repository.js';
import { EVENTS_REPOSITORY } from './events.repository.js';

@Module({
  providers: [
    { provide: EVENTS_REPOSITORY, useClass: DrizzleEventsRepository },
  ],
  exports: [EVENTS_REPOSITORY],
})
export class EventsStoreModule {}
