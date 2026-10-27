import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DATABASE, type Database } from '../src/db/database.js';
import { users } from '../src/db/schema.js';
import { createTestApp } from './create-test-app.js';
import { api, errorOf, PASSWORD, signUp } from './helpers.js';

describe('Auth: register and login (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (email: string) =>
    api(app).post('/v1/auth/register').send({ email, password: PASSWORD });
  const login = (email: string, password: string) =>
    api(app).post('/v1/auth/login').send({ email, password });

  it('registers with a lowercased email and an argon2id hash', async () => {
    const res = await register(' Dev@Example.COM ').expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      email: 'dev@example.com',
    });

    const [stored] = await app.get<Database>(DATABASE).select().from(users);
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await register('dev@example.com').expect(201);
    const res = await register('DEV@example.com').expect(409);
    expect(errorOf(res).code).toBe('EMAIL_TAKEN');
  });

  it('logs in with an access token for the user', async () => {
    const userId = ((await register('dev@example.com')).body as { id: string })
      .id;
    const res = await login('dev@example.com', PASSWORD).expect(200);

    const { accessToken, expiresIn } = res.body as {
      accessToken: string;
      expiresIn: number;
    };
    expect(expiresIn).toBe(900);
    const payload = await app
      .get(JwtService)
      .verifyAsync<{ sub: string }>(accessToken);
    expect(payload.sub).toBe(userId);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    await signUp(app);
    const wrongPassword = await login('dev@example.com', 'wrong-pass').expect(
      401,
    );
    const unknownEmail = await login('nobody@example.com', PASSWORD).expect(
      401,
    );

    expect(errorOf(wrongPassword).code).toBe('INVALID_CREDENTIALS');
    expect(errorOf(unknownEmail).message).toBe(errorOf(wrongPassword).message);
  });
});
