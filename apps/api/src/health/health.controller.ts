import { Controller, Get, HttpStatus, Inject, Logger } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';
import { REDIS } from '../redis/redis.js';

@Public()
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const results = await Promise.allSettled([
      this.db.execute(sql`select 1`),
      this.redis.ping(),
    ]);
    const failures = (['Database', 'Redis'] as const).flatMap((name, i) => {
      const result = results[i]!;
      return result.status === 'rejected'
        ? [`${name} check failed: ${String(result.reason)}`]
        : [];
    });
    if (failures.length > 0) {
      failures.forEach((failure) => this.logger.warn(failure));
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'NOT_READY',
        'Service is not ready',
      );
    }
    return { status: 'ready' };
  }
}
