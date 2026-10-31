import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Redis, type Result } from 'ioredis';
import { ApiException } from '../common/errors/api-exception.js';
import { REDIS } from '../redis/redis.js';
import { TOKEN_BUCKET_LUA } from './token-bucket.lua.js';

declare module 'ioredis' {
  interface RedisCommander<Context> {
    tokenBucket(
      key: string,
      capacity: number,
      tokensPerMs: number,
    ): Result<[number, number, number, number], Context>;
  }
}

export interface RateLimitPolicy {
  name: string;
  capacity: number;
  refillPerSecond: number;
  whenUnavailable: 'allow' | 'reject';
}

export const RATE_LIMITS = {
  ingestionIp: {
    name: 'ingest:ip',
    capacity: 20,
    refillPerSecond: 10,
    whenUnavailable: 'allow',
  },
  ingestionKey: {
    name: 'ingest:key',
    capacity: 100,
    refillPerSecond: 50,
    whenUnavailable: 'allow',
  },
  login: {
    name: 'login',
    capacity: 5,
    refillPerSecond: 5 / 900,
    whenUnavailable: 'reject',
  },
} as const satisfies Record<string, RateLimitPolicy>;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetSeconds: number;
}

const WARN_INTERVAL_MS = 10_000;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly enabled: boolean;
  private lastWarnedAt = 0;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.enabled = config.getOrThrow<boolean>('RATE_LIMITS_ENABLED');
    redis.defineCommand('tokenBucket', {
      numberOfKeys: 1,
      lua: TOKEN_BUCKET_LUA,
    });
  }

  async consume(
    policy: RateLimitPolicy,
    id: string,
  ): Promise<RateLimitResult | null> {
    if (!this.enabled) return null;
    let reply: [number, number, number, number];
    try {
      reply = await this.redis.tokenBucket(
        `rl:${policy.name}:${id}`,
        policy.capacity,
        policy.refillPerSecond / 1000,
      );
    } catch (err) {
      return this.unavailable(policy, err);
    }
    const [allowed, remaining, retryMs, fullMs] = reply;
    return {
      allowed: allowed === 1,
      limit: policy.capacity,
      remaining,
      retryAfterSeconds: Math.ceil(retryMs / 1000),
      resetSeconds: Math.ceil(fullMs / 1000),
    };
  }

  async enforce(
    policy: RateLimitPolicy,
    id: string,
    res: Response,
  ): Promise<void> {
    const result = await this.consume(policy, id);
    if (!result) return;
    const reported = res.getHeader('RateLimit-Remaining');
    if (reported === undefined || result.remaining < Number(reported)) {
      res.setHeader('RateLimit-Limit', result.limit);
      res.setHeader('RateLimit-Remaining', result.remaining);
      res.setHeader('RateLimit-Reset', result.resetSeconds);
    }
    if (result.allowed) return;
    res.setHeader('Retry-After', result.retryAfterSeconds);
    throw new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMITED',
      'Too many requests, retry later',
    );
  }

  private unavailable(policy: RateLimitPolicy, err: unknown): null {
    if (policy.whenUnavailable === 'reject') {
      this.logger.warn(
        `Rate limit ${policy.name} unavailable, rejecting: ${String(err)}`,
      );
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'RATE_LIMIT_UNAVAILABLE',
        'Service is temporarily unavailable',
      );
    }
    const now = Date.now();
    if (now - this.lastWarnedAt >= WARN_INTERVAL_MS) {
      this.lastWarnedAt = now;
      this.logger.warn(
        `Rate limit ${policy.name} unavailable, allowing requests: ${String(err)}`,
      );
    }
    return null;
  }
}
