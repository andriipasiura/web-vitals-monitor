import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import { closeRedis, createRedis, REDIS } from './redis.js';

@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  static forRoot(options: RedisOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS,
          inject: [ConfigService],
          useFactory: (config: ConfigService) =>
            createRedis(
              config.getOrThrow<string>('REDIS_URL'),
              options,
              'command',
            ),
        },
      ],
      exports: [REDIS],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await closeRedis(this.redis);
  }
}
