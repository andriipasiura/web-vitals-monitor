import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
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

  it('GET /ready reports readiness', () => {
    return request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });
});
