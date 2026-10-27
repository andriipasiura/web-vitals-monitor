import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { uuidParam } from '../common/validation/uuid-param.pipe.js';
import { ApiKeysService } from './api-keys.service.js';

@Controller('v1/projects/:projectId/keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuidParam) projectId: string,
  ) {
    return this.apiKeysService.create(user.id, projectId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuidParam) projectId: string,
  ) {
    return this.apiKeysService.list(user.id, projectId);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuidParam) projectId: string,
    @Param('keyId', uuidParam) keyId: string,
  ): Promise<void> {
    return this.apiKeysService.revoke(user.id, projectId, keyId);
  }
}
