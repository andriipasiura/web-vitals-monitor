import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  AttributionQuerySchema,
  MetricsQuerySchema,
  PathsQuerySchema,
  RoutesQuerySchema,
  type AttributionQuery,
  type MetricsQuery,
  type PathsQuery,
  type RoutesQuery,
} from '@rum/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { uuidParam } from '../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('v1/projects/:id')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('metrics')
  metrics(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Query(new ZodValidationPipe(MetricsQuerySchema)) query: MetricsQuery,
  ) {
    return this.analyticsService.metrics(user.id, id, query);
  }

  @Get('routes')
  routes(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Query(new ZodValidationPipe(RoutesQuerySchema)) query: RoutesQuery,
  ) {
    return this.analyticsService.routes(user.id, id, query);
  }

  @Get('routes/paths')
  paths(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Query(new ZodValidationPipe(PathsQuerySchema)) query: PathsQuery,
  ) {
    return this.analyticsService.paths(user.id, id, query);
  }

  @Get('routes/attribution')
  attribution(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Query(new ZodValidationPipe(AttributionQuerySchema))
    query: AttributionQuery,
  ) {
    return this.analyticsService.attribution(user.id, id, query);
  }
}
