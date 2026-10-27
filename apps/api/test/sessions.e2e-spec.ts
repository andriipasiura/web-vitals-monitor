import { NestExpressApplication } from '@nestjs/platform-express';
import { DATABASE, type Database } from '../src/db/database.js';
import { refreshTokens } from '../src/db/schema.js';
import { createTestApp } from './create-test-app.js';
import {
  api,
  errorOf,
  login,
  refresh,
  refreshCookieOf,
  signUp,
} from './helpers.js';

describe('Sessions (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectInvalidRefresh = async (refreshToken: string) => {
    const res = await refresh(app, refreshToken).expect(401);
    expect(errorOf(res).code).toBe('INVALID_REFRESH_TOKEN');
  };

  it('sets a scoped HttpOnly cookie and stores only its hash', async () => {
    await signUp(app);
    const res = await api(app)
      .post('/v1/auth/login')
      .send({ email: 'dev@example.com', password: 'correct-horse' });

    const cookie = refreshCookieOf(res)!;
    for (const attribute of [
      'Max-Age=2592000',
      'Path=/v1/auth',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
    ]) {
      expect(cookie).toContain(attribute);
    }

    const rows = await app
      .get<Database>(DATABASE)
      .select({ tokenHash: refreshTokens.tokenHash })
      .from(refreshTokens);
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.tokenHash))).toBe(
      true,
    );
  });

  it('rotates the refresh token', async () => {
    const { refreshToken } = await signUp(app);

    const res = await refresh(app, refreshToken).expect(200);
    const rotated = refreshCookieOf(res)!.split(';')[0]!.slice(3);

    expect(rotated).not.toBe(refreshToken);
    await refresh(app, rotated).expect(200);
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const { refreshToken: stolen } = await signUp(app);
    const res = await refresh(app, stolen).expect(200);
    const rotated = refreshCookieOf(res)!.split(';')[0]!.slice(3);
    const otherDevice = await login(app);

    await expectInvalidRefresh(stolen);
    await expectInvalidRefresh(rotated);
    await refresh(app, otherDevice.refreshToken).expect(200);
  });

  it('logout revokes the current family only', async () => {
    const session = await signUp(app);
    const otherDevice = await login(app);

    await api(app)
      .post('/v1/auth/logout')
      .auth(session.accessToken, { type: 'bearer' })
      .set('Cookie', `rt=${session.refreshToken}`)
      .expect(204);

    await expectInvalidRefresh(session.refreshToken);
    await refresh(app, otherDevice.refreshToken).expect(200);
  });

  it('logout-all revokes every session of the user', async () => {
    const laptop = await signUp(app);
    const phone = await login(app);
    const someoneElse = await signUp(app, 'other@example.com');

    await api(app)
      .post('/v1/auth/logout-all')
      .auth(phone.accessToken, { type: 'bearer' })
      .expect(204);

    await expectInvalidRefresh(laptop.refreshToken);
    await expectInvalidRefresh(phone.refreshToken);
    await refresh(app, someoneElse.refreshToken).expect(200);
  });

  it('JwtAuthGuard rejects missing and invalid tokens', async () => {
    for (const authorization of [undefined, 'Bearer not-a-jwt']) {
      const req = api(app).post('/v1/auth/logout-all');
      if (authorization) req.set('Authorization', authorization);
      expect(errorOf(await req.expect(401)).code).toBe('UNAUTHORIZED');
    }
    await api(app).get('/ready').expect(200);
  });

  it('applies CORS per route', async () => {
    const dashboard = await api(app)
      .options('/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(dashboard.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(dashboard.headers['access-control-allow-credentials']).toBe('true');

    const ingestion = await api(app)
      .options('/v1/events')
      .set('Origin', 'https://shop.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(ingestion.headers['access-control-allow-origin']).toBe('*');
  });
});
