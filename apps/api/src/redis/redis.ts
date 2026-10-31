import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

export const REDIS = Symbol('REDIS');

const ERROR_LOG_INTERVAL_MS = 10_000;

export const COMMAND_CLIENT_OPTIONS: RedisOptions = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 200,
};

export const WORKER_COMMAND_CLIENT_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
};

export const PRODUCER_CLIENT_OPTIONS: RedisOptions = {
  enableOfflineQueue: false,
};

export const WORKER_CLIENT_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
};

export function createRedis(
  url: string,
  options: RedisOptions,
  name: string,
): Redis {
  const client = new Redis(url, options);
  const logger = new Logger(`Redis:${name}`);
  let lastLoggedAt = 0;
  client.on('error', (err: Error) => {
    const now = Date.now();
    if (now - lastLoggedAt < ERROR_LOG_INTERVAL_MS) return;
    lastLoggedAt = now;
    logger.warn(`Redis error: ${err.message}`);
  });
  return client;
}

export async function closeRedis(client: Redis): Promise<void> {
  if (client.status === 'ready') {
    await client.quit();
  } else {
    client.disconnect();
  }
}
