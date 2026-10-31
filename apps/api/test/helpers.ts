import type { INestApplicationContext } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { asc } from 'drizzle-orm';
import request from 'supertest';
import type { ErrorResponseBody } from '../src/common/errors/all-exceptions.filter.js';
import { DATABASE, type Database } from '../src/db/database.js';
import { EventsQueue } from '../src/events/events.queue.js';
import { generateToken, sha256 } from '../src/common/crypto/tokens.js';
import { apiKeys, events, projects, users } from '../src/db/schema.js';
import { COMMAND_CLIENT_OPTIONS, createRedis } from '../src/redis/redis.js';

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

export const database = (app: INestApplicationContext) =>
  app.get<Database>(DATABASE);

export const storedEvents = (app: NestExpressApplication) =>
  database(app).select().from(events).orderBy(asc(events.id));

export const deadRedis = () =>
  createRedis('redis://127.0.0.1:1', COMMAND_CLIENT_OPTIONS, 'dead');

export async function seedIngestionKey(
  app: NestExpressApplication,
  allowedOrigins = ['https://shop.example'],
) {
  const db = database(app);
  const [owner] = await db
    .insert(users)
    .values({ email: 'seed@example.com', passwordHash: 'unused' })
    .returning({ id: users.id });
  const [project] = await db
    .insert(projects)
    .values({ ownerId: owner!.id, name: 'Shop', allowedOrigins })
    .returning({ id: projects.id });
  const key = generateToken('pk_');
  await db.insert(apiKeys).values({
    projectId: project!.id,
    keyHash: sha256(key),
    prefix: key.slice(0, 11),
  });
  return { projectId: project!.id, key };
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function drainQueue(
  app: NestExpressApplication,
  timeoutMs = 10_000,
): Promise<void> {
  const { queue } = app.get(EventsQueue);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'prioritized',
    );
    if (Object.values(counts).every((count) => count === 0)) return;
    if (Date.now() > deadline) {
      throw new Error(`Queue not drained: ${JSON.stringify(counts)}`);
    }
    await sleep(20);
  }
}
