import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { requestIdMiddleware } from './common/request-id/request-id.middleware.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';

import { z } from 'zod';
import { ConfigModule } from '@nestjs/config';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = EnvSchema.safeParse(config);
        if (!result.success) {
          throw new Error(`Invalid env:\n${z.prettifyError(result.error)}`);
        }
        return result.data;
      },
    }),
    HealthModule,
    EventsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
