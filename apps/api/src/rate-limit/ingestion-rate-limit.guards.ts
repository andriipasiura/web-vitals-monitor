import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RATE_LIMITS, RateLimitService } from './rate-limit.service.js';

@Injectable()
export class IngestionIpRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimits: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    await this.rateLimits.enforce(
      RATE_LIMITS.ingestionIp,
      req.ip ?? 'unknown',
      http.getResponse<Response>(),
    );
    return true;
  }
}

@Injectable()
export class IngestionKeyRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimits: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    await this.rateLimits.enforce(
      RATE_LIMITS.ingestionKey,
      http.getRequest<Request>().project!.apiKeyId,
      http.getResponse<Response>(),
    );
    return true;
  }
}
