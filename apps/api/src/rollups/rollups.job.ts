import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RollupsService } from './rollups.service.js';

@Injectable()
export class RollupsJob {
  private readonly logger = new Logger(RollupsJob.name);

  constructor(private readonly rollups: RollupsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      const outcome = await this.rollups.recomputeRecent();
      if (!outcome.acquired) {
        this.logger.log('Rollup skipped: lock held elsewhere');
      }
    } catch (err) {
      this.logger.error(`Rollup failed: ${String(err)}`);
    }
  }
}
