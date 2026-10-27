import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiException } from '../common/errors/api-exception.js';
import { IS_PUBLIC } from './auth.decorators.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    try {
      if (scheme !== 'Bearer' || !token) throw new Error('No bearer token');
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      req.user = { id: sub };
      return true;
    } catch {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Missing or invalid access token',
      );
    }
  }
}
