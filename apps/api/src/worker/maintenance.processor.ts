import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PartitionsService } from '../events/partitions.service.js';
import { RollupsService } from '../rollups/rollups.service.js';

export const MAINTENANCE_QUEUE_NAME = 'maintenance';

export const MAINTENANCE_SCHEDULES = {
  rollups: 5 * 60 * 1000,
  partitions: 60 * 60 * 1000,
} as const;

export type MaintenanceJobName = keyof typeof MAINTENANCE_SCHEDULES;

@Injectable()
export class MaintenanceProcessor {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly rollups: RollupsService,
    private readonly partitions: PartitionsService,
  ) {}

  async process(job: Job): Promise<void> {
    switch (job.name as MaintenanceJobName) {
      case 'rollups': {
        const outcome = await this.rollups.recomputeRecent();
        if (!outcome.acquired) {
          this.logger.log('Rollup skipped: lock held elsewhere');
        }
        return;
      }
      case 'partitions':
        await this.partitions.maintain();
        return;
      default:
        throw new Error(`Unknown maintenance job ${job.name}`);
    }
  }
}
