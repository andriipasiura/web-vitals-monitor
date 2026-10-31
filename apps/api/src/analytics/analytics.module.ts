import { Module } from '@nestjs/common';
import { QueryCache } from '../cache/query-cache.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, QueryCache],
})
export class AnalyticsModule {}
