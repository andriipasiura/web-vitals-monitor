import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { sha256 } from '../common/crypto/tokens.js';
import { REDIS } from '../redis/redis.js';

export const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_JITTER = 0.1;
export const CACHE_LOCK_TTL_MS = 5000;
const POLL_INTERVAL_MS = 50;
const POLL_ATTEMPTS = 20;
const WARN_INTERVAL_MS = 10_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const cacheTtlSeconds = () =>
  Math.round(
    CACHE_TTL_SECONDS *
      (1 - CACHE_TTL_JITTER + Math.random() * 2 * CACHE_TTL_JITTER),
  );

@Injectable()
export class QueryCache {
  private readonly logger = new Logger(QueryCache.name);
  private lastWarnedAt = 0;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  key(kind: string, projectId: string, query: object): string {
    const normalized = JSON.stringify(query, Object.keys(query).sort());
    return `cache:${kind}:${projectId}:${sha256(normalized)}`;
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    let filling: boolean;
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;

      filling =
        (await this.redis.set(
          `lock:${key}`,
          randomUUID(),
          'PX',
          CACHE_LOCK_TTL_MS,
          'NX',
        )) === 'OK';
      if (!filling) {
        const filled = await this.poll(key);
        if (filled !== null) return JSON.parse(filled) as T;
      }
    } catch (err) {
      this.warn(err);
      return load();
    }

    const value = await load();
    if (filling) {
      try {
        await this.redis.set(
          key,
          JSON.stringify(value),
          'EX',
          cacheTtlSeconds(),
        );
      } catch (err) {
        this.warn(err);
      }
    }
    return value;
  }

  private async poll(key: string): Promise<string | null> {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const cached = await this.redis.get(key);
      if (cached !== null) return cached;
    }
    return null;
  }

  private warn(err: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnedAt < WARN_INTERVAL_MS) return;
    this.lastWarnedAt = now;
    this.logger.warn(
      `Cache unavailable, reading from Postgres: ${String(err)}`,
    );
  }
}
