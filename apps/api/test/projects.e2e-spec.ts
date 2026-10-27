import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp } from './create-test-app.js';
import { api, createProject, errorOf, signUp } from './helpers.js';

describe('Projects (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ({ accessToken: token } = await signUp(app));
  });

  it('creates, lists, reads, updates and deletes a project', async () => {
    const created = await createProject(app, token, {
      name: 'Shop',
      allowedOrigins: ['HTTPS://Shop.Example:443'],
    });
    expect(created).toEqual({
      id: expect.any(String),
      name: 'Shop',
      allowedOrigins: ['https://shop.example'],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const url = `/v1/projects/${created.id}`;

    await api(app)
      .get('/v1/projects')
      .auth(token, { type: 'bearer' })
      .expect(200, [created]);
    await api(app)
      .get(url)
      .auth(token, { type: 'bearer' })
      .expect(200, created);

    const updated = await api(app)
      .patch(url)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Store' })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Store' });

    await api(app).delete(url).auth(token, { type: 'bearer' }).expect(204);
    await api(app).get(url).auth(token, { type: 'bearer' }).expect(404);
  });

  it('requires authentication', async () => {
    await api(app).get('/v1/projects').expect(401);
  });

  it("returns 404 for another user's project and leaves it unchanged", async () => {
    const { id } = await createProject(app, token);
    const { accessToken: intruder } = await signUp(app, 'intruder@example.com');
    const url = `/v1/projects/${id}`;

    for (const send of [
      () => api(app).get(url),
      () => api(app).patch(url).send({ name: 'Mine' }),
      () => api(app).delete(url),
    ]) {
      const res = await send().auth(intruder, { type: 'bearer' }).expect(404);
      expect(errorOf(res).code).toBe('PROJECT_NOT_FOUND');
    }

    const res = await api(app).get(url).auth(token, { type: 'bearer' });
    expect(res.body).toMatchObject({ name: 'Shop' });
  });
});
