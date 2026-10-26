import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DATABASE } from '../src/db/database.js';
import { createTestApp } from './create-test-app.js';

describe('Health (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports liveness', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /ready reports readiness when the database answers', () => {
    return request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });
});

describe('Health when the database is down (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(DATABASE).useValue({
        execute: () => Promise.reject(new Error('connection refused')),
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ready returns 503', async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(503);

    expect(res.body).toMatchObject({ error: { code: 'NOT_READY' } });
    expect(res.text).not.toContain('connection refused');
  });

  it('GET /health stays up', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });
});
