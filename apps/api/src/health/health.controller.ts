import { Controller, Get, HttpStatus, Inject, Logger } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { sql } from 'drizzle-orm';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';

@Public()
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
    } catch (err) {
      this.logger.warn(`Database check failed: ${String(err)}`);
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'NOT_READY',
        'Service is not ready',
      );
    }
    return { status: 'ready' };
  }
}
