import { NestApplicationOptions } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import { REQUEST_ID_HEADER } from './common/request-id/request-id.middleware.js';
import type { Env } from './config/env.js';

export const appOptions = {
  bodyParser: false,
} satisfies NestApplicationOptions;

const INGESTION_PATH = '/v1/events';

const ingestionCors: CorsOptions = {
  origin: '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'X-Api-Key'],
  exposedHeaders: [
    'Retry-After',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
  ],
  maxAge: 86_400,
};

export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const trustProxy = config.get<Env['TRUST_PROXY']>('TRUST_PROXY');
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);

  const dashboardCors: CorsOptions = {
    origin: config.getOrThrow<string>('DASHBOARD_ORIGIN'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [REQUEST_ID_HEADER],
  };

  app.enableCors((req: Request, callback) => {
    callback(null, req.path === INGESTION_PATH ? ingestionCors : dashboardCors);
  });
}
