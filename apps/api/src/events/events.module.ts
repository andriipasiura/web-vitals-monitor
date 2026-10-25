import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MAX_BATCH_BODY_BYTES } from '@rum/shared';
import { createJsonBodyParser } from '../common/body-parser/json-body-parser.js';
import { EventsController } from './events.controller.js';
import { EVENTS_REPOSITORY } from './events.repository.js';
import { EventsService } from './events.service.js';
import { InMemoryEventsRepository } from './in-memory-events.repository.js';

@Module({
  controllers: [EventsController],
  providers: [
    EventsService,
    { provide: EVENTS_REPOSITORY, useClass: InMemoryEventsRepository },
  ],
})
export class EventsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        createJsonBodyParser({
          limit: MAX_BATCH_BODY_BYTES,
          types: ['application/json', 'text/plain'],
        }),
      )
      .forRoutes(EventsController);
  }
}
