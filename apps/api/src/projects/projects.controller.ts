import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@rum/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { uuidParam } from '../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { ProjectsService } from './projects.service.js';

@Controller('v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateProjectSchema)) input: CreateProjectInput,
  ) {
    return this.projectsService.create(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projectsService.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string) {
    return this.projectsService.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) input: UpdateProjectInput,
  ) {
    return this.projectsService.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    return this.projectsService.delete(user.id, id);
  }
}
