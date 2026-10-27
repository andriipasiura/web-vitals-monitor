import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { OriginSchema } from '@rum/shared';
import type { Request } from 'express';
import { ApiException } from '../common/errors/api-exception.js';
import { ApiKeysService } from './api-keys.service.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const query: unknown = req.query.key;
    const key = req.get('x-api-key') || (typeof query === 'string' && query);
    if (!key) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'MISSING_API_KEY',
        'An API key is required',
      );
    }

    const project = await this.apiKeys.findProject(key);
    if (!project) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_API_KEY',
        'API key is invalid or revoked',
      );
    }

    const origin = OriginSchema.safeParse(req.get('origin'));
    if (!origin.success || !project.allowedOrigins.includes(origin.data)) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'ORIGIN_NOT_ALLOWED',
        'Origin is not allowed for this project',
      );
    }

    req.project = project;
    return true;
  }
}

export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().project!,
);
