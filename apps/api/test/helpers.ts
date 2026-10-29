import { NestExpressApplication } from '@nestjs/platform-express';
import { asc } from 'drizzle-orm';
import request from 'supertest';
import type { ErrorResponseBody } from '../src/common/errors/all-exceptions.filter.js';
import { DATABASE, type Database } from '../src/db/database.js';
import { events } from '../src/db/schema.js';

export const PASSWORD = 'correct-horse';

export const api = (app: NestExpressApplication) =>
  request(app.getHttpServer());

export const errorOf = (res: request.Response) =>
  (res.body as ErrorResponseBody).error;

export function refreshCookieOf(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((cookie) => cookie.startsWith('rt='));
}

export async function login(
  app: NestExpressApplication,
  email = 'dev@example.com',
) {
  const res = await api(app)
    .post('/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return {
    accessToken: (res.body as { accessToken: string }).accessToken,
    refreshToken: refreshCookieOf(res)!.split(';')[0]!.slice(3),
  };
}

export async function signUp(
  app: NestExpressApplication,
  email = 'dev@example.com',
) {
  await api(app)
    .post('/v1/auth/register')
    .send({ email, password: PASSWORD })
    .expect(201);
  return login(app, email);
}

export const refresh = (app: NestExpressApplication, refreshToken: string) =>
  api(app).post('/v1/auth/refresh').set('Cookie', `rt=${refreshToken}`);

export async function createProject(
  app: NestExpressApplication,
  accessToken: string,
  body: object = { name: 'Shop', allowedOrigins: ['https://shop.example'] },
) {
  const res = await api(app)
    .post('/v1/projects')
    .auth(accessToken, { type: 'bearer' })
    .send(body)
    .expect(201);
  return res.body as { id: string; name: string; allowedOrigins: string[] };
}

export async function createApiKey(
  app: NestExpressApplication,
  accessToken: string,
  projectId: string,
) {
  const res = await api(app)
    .post(`/v1/projects/${projectId}/keys`)
    .auth(accessToken, { type: 'bearer' })
    .expect(201);
  return res.body as { id: string; key: string; prefix: string };
}

export const database = (app: NestExpressApplication) =>
  app.get<Database>(DATABASE);

export const storedEvents = (app: NestExpressApplication) =>
  database(app).select().from(events).orderBy(asc(events.id));
