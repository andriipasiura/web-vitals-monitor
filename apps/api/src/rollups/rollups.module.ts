import { Module } from '@nestjs/common';
import { RollupsJob } from './rollups.job.js';
import { RollupsService } from './rollups.service.js';

@Module({
  providers: [RollupsService, RollupsJob],
  exports: [RollupsService],
})
export class RollupsModule {}
