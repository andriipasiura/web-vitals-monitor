import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  createJsonBodyParser,
  DASHBOARD_BODY_LIMIT_BYTES,
} from '../common/body-parser/json-body-parser.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        createJsonBodyParser({
          limit: DASHBOARD_BODY_LIMIT_BYTES,
          types: ['application/json'],
        }),
      )
      .forRoutes(ProjectsController);
  }
}
