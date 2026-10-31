import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_BATCH_BODY_BYTES } from '@rum/shared';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { createJsonBodyParser } from '../common/body-parser/json-body-parser.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { createRedis, PRODUCER_CLIENT_OPTIONS } from '../redis/redis.js';
import { EventsStoreModule } from './events-store.module.js';
import { EventsController } from './events.controller.js';
import { EventsQueue } from './events.queue.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [ApiKeysModule, RateLimitModule, EventsStoreModule],
  controllers: [EventsController],
  providers: [
    EventsService,
    {
      provide: EventsQueue,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new EventsQueue(
          createRedis(
            config.getOrThrow<string>('REDIS_URL'),
            PRODUCER_CLIENT_OPTIONS,
            'producer',
          ),
        ),
    },
  ],
  exports: [EventsQueue],
})
export class EventsModule implements NestModule, OnApplicationShutdown {
  constructor(private readonly queue: EventsQueue) {}

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

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
