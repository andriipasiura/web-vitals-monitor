import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MAX_BATCH_BODY_BYTES } from '@rum/shared';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { createJsonBodyParser } from '../common/body-parser/json-body-parser.js';
import { EventsController } from './events.controller.js';
import { EVENTS_REPOSITORY } from './events.repository.js';
import { EventsService } from './events.service.js';
import { PartitionsService } from './partitions.service.js';
import { DrizzleEventsRepository } from './drizzle-events.repository.js';

@Module({
  imports: [ApiKeysModule],
  controllers: [EventsController],
  providers: [
    EventsService,
    PartitionsService,
    { provide: EVENTS_REPOSITORY, useClass: DrizzleEventsRepository },
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
