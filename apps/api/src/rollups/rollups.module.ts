import { Module } from '@nestjs/common';
import { RollupsService } from './rollups.service.js';

@Module({
  providers: [RollupsService],
  exports: [RollupsService],
})
export class RollupsModule {}
