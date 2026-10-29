import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import type { ErrorResponseBody } from '../src/common/errors/all-exceptions.filter.js';
import { EVENTS_REPOSITORY } from '../src/events/events.repository.js';
import { createTestApp } from './create-test-app.js';
import {
  api,
  createApiKey,
  createProject,
  signUp,
  storedEvents,
} from './helpers.js';

const ORIGIN = 'https://shop.example';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function event(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: randomUUID(),
    metric: 'LCP',
    value: 2100,
    path: '/products/42',
    deviceType: 'mobile',
    ...overrides,
  };
}

function expectError(
  res: request.Response,
  status: number,
  code: string,
): ErrorResponseBody['error'] {
  const { error } = res.body as ErrorResponseBody;
  expect(res.status).toBe(status);
  expect(error.code).toBe(code);
  expect(error.requestId).toBe(res.headers['x-request-id']);
  expect(res.text).not.toContain('stack');
  return error;
}

interface Ingestion {
  accessToken: string;
  projectId: string;
  key: string;
  keyId: string;
}

async function setUpIngestion(
  app: NestExpressApplication,
  email = 'dev@example.com',
): Promise<Ingestion> {
  const { accessToken } = await signUp(app, email);
  const { id: projectId } = await createProject(app, accessToken, {
    name: 'Shop',
    allowedOrigins: [ORIGIN],
  });
  const { key, id: keyId } = await createApiKey(app, accessToken, projectId);
  return { accessToken, projectId, key, keyId };
}

describe('POST /v1/events (e2e)', () => {
  let app: NestExpressApplication;
  let ingestion: Ingestion;

  beforeEach(async () => {
    app = await createTestApp();
    ingestion = await setUpIngestion(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = () =>
    api(app)
      .post('/v1/events')
      .set('X-Api-Key', ingestion.key)
      .set('Origin', ORIGIN);

  describe('ingestion key and origin', () => {
    const batch = () => ({ events: [event()] });
    const bare = () => api(app).post('/v1/events').set('Origin', ORIGIN);

    it('accepts a valid key and origin and tags events with the project', async () => {
      await post().send(batch()).expect(202);
      expect(await storedEvents(app)).toMatchObject([
        { projectId: ingestion.projectId },
      ]);
    });

    it('accepts the key as a query parameter for sendBeacon', async () => {
      await bare()
        .query({ key: ingestion.key })
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(batch()))
        .expect(202);
    });

    it('rejects a missing or unknown key with 401', async () => {
      expectError(await bare().send(batch()), 401, 'MISSING_API_KEY');
      expectError(
        await bare().set('X-Api-Key', 'pk_unknown').send(batch()),
        401,
        'INVALID_API_KEY',
      );
      expect(await storedEvents(app)).toHaveLength(0);
    });

    it('rejects a revoked key while a rotated-in key keeps working', async () => {
      const replacement = await createApiKey(
        app,
        ingestion.accessToken,
        ingestion.projectId,
      );
      await api(app)
        .delete(`/v1/projects/${ingestion.projectId}/keys/${ingestion.keyId}`)
        .auth(ingestion.accessToken, { type: 'bearer' })
        .expect(204);

      expectError(await post().send(batch()), 401, 'INVALID_API_KEY');
      await bare().set('X-Api-Key', replacement.key).send(batch()).expect(202);
    });

    it.each(['https://evil.example', 'null', undefined])(
      'rejects origin %s with 403',
      async (origin) => {
        const req = api(app).post('/v1/events').set('X-Api-Key', ingestion.key);
        if (origin) req.set('Origin', origin);
        expectError(await req.send(batch()), 403, 'ORIGIN_NOT_ALLOWED');
      },
    );
  });

  describe('valid batches', () => {
    it('accepts application/json and stores enriched events', async () => {
      const serverRouted = event({
        metric: 'LCP',
        value: 5000,
        path: '/products/123',
        rating: 'good',
      });
      const sdkRouted = event({
        metric: 'CLS',
        value: 0.05,
        path: '/blog/hello',
        route: '/blog/[slug]',
        connectionType: '4g',
        release: '1.2.3',
        attribution: { largestShiftTarget: 'main > div.hero' },
      });

      const res = await post()
        .send({ events: [serverRouted, sdkRouted] })
        .expect(202);

      expect(res.text).toBe('');
      expect(res.headers['x-request-id']).toMatch(UUID);

      const stored = await storedEvents(app);
      expect(stored).toHaveLength(2);
      expect(stored[0]).toMatchObject({
        clientEventId: serverRouted.clientEventId,
        route: '/products/:id',
        routeSource: 'server',
        rating: 'poor',
      });
      expect(stored[1]).toMatchObject({
        clientEventId: sdkRouted.clientEventId,
        route: '/blog/[slug]',
        routeSource: 'sdk',
        rating: 'good',
        connectionType: '4g',
        release: '1.2.3',
        attribution: { largestShiftTarget: 'main > div.hero' },
      });
      expect(stored[0]?.receivedAt).toBeInstanceOf(Date);
    });

    it('accepts JSON sent as text/plain (sendBeacon)', async () => {
      const sent = event();

      await post()
        .set('Content-Type', 'text/plain;charset=UTF-8')
        .send(JSON.stringify({ events: [sent] }))
        .expect(202);

      expect(await storedEvents(app)).toMatchObject([
        { clientEventId: sent.clientEventId },
      ]);
    });

    it('stores a resent event again', async () => {
      const batch = { events: [event()] };

      await post().send(batch).expect(202);
      await post().send(batch).expect(202);

      expect(await storedEvents(app)).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('rejects invalid events with field details', async () => {
      const res = await post().send({
        events: [
          event({ metric: 'FID' }),
          event({ path: '/search?q=secret' }),
          event({ clientEventId: 'not-a-uuid' }),
        ],
      });

      const error = expectError(res, 400, 'VALIDATION_FAILED');
      expect(error.message).toBe('Request validation failed');
      expect(error.details).toEqual([
        expect.objectContaining({ path: 'events.0.metric' }),
        expect.objectContaining({ path: 'events.1.path' }),
        expect.objectContaining({ path: 'events.2.clientEventId' }),
      ]);
      expect(await storedEvents(app)).toHaveLength(0);
    });

    it.each([0, 11])('rejects a batch of %i events', async (count) => {
      const res = await post().send({
        events: Array.from({ length: count }, () => event()),
      });

      const error = expectError(res, 400, 'VALIDATION_FAILED');
      expect(error.details).toEqual([
        expect.objectContaining({ path: 'events' }),
      ]);
    });

    it('rejects a request without a body', async () => {
      expectError(await post(), 400, 'VALIDATION_FAILED');
    });
  });

  describe('body parsing', () => {
    it.each(['application/json', 'text/plain'])(
      'rejects malformed JSON sent as %s',
      async (contentType) => {
        const res = await post()
          .set('Content-Type', contentType)
          .send('{"events": [');

        expectError(res, 400, 'MALFORMED_JSON');
      },
    );

    it('rejects a JSON body that is not an object or array', async () => {
      const res = await post()
        .set('Content-Type', 'application/json')
        .send('"events"');

      expectError(res, 400, 'MALFORMED_JSON');
    });

    it.each(['application/json', 'text/plain'])(
      'rejects a body over 32 KB sent as %s',
      async (contentType) => {
        const body = JSON.stringify({
          events: [event({ attribution: { pad: 'x'.repeat(33 * 1024) } })],
        });

        const res = await post().set('Content-Type', contentType).send(body);

        const error = expectError(res, 413, 'PAYLOAD_TOO_LARGE');
        expect(error.message).toBe('Request body must not exceed 32768 bytes');
      },
    );

    it('rejects unsupported content types', async () => {
      const res = await post()
        .set('Content-Type', 'application/xml')
        .send('<events/>');

      expectError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('echoes the client request id in error responses', async () => {
      const res = await post()
        .set('Content-Type', 'text/plain')
        .set('x-request-id', 'beacon-123')
        .send('{oops');

      expect(expectError(res, 400, 'MALFORMED_JSON').requestId).toBe(
        'beacon-123',
      );
    });
  });
});

describe('POST /v1/events when storage fails (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(EVENTS_REPOSITORY).useValue({
        saveMany: () => Promise.reject(new Error('secret detail')),
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a generic 500 without internals', async () => {
    const { key } = await setUpIngestion(app);

    const res = await api(app)
      .post('/v1/events')
      .set('X-Api-Key', key)
      .set('Origin', ORIGIN)
      .send({ events: [event()] });

    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: res.headers['x-request-id'],
      },
    });
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('secret detail');
  });
});
