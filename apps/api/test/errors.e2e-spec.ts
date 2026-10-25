import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { ErrorResponseBody } from '../src/common/errors/all-exceptions.filter.js';
import { createTestApp } from './create-test-app.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Request id and error format (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('renders unknown routes as NOT_FOUND in the common error format', async () => {
    const res = await request(app.getHttpServer()).get('/missing').expect(404);

    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /missing',
        requestId: res.headers['x-request-id'],
      },
    });
  });

  it('generates a request id when none is sent', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('echoes a valid client request id in the header and error body', async () => {
    const res = await request(app.getHttpServer())
      .get('/missing')
      .set('x-request-id', 'edge-01:abc.123')
      .expect(404);

    expect(res.headers['x-request-id']).toBe('edge-01:abc.123');
    expect((res.body as ErrorResponseBody).error.requestId).toBe(
      'edge-01:abc.123',
    );
  });

  it.each([
    ['contains spaces', 'not a valid id'],
    ['is too long', 'a'.repeat(129)],
  ])('replaces a client request id that %s', async (_case, incoming) => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', incoming)
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID);
  });
});
