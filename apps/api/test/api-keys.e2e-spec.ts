import { NestExpressApplication } from '@nestjs/platform-express';
import { DATABASE, type Database } from '../src/db/database.js';
import { apiKeys } from '../src/db/schema.js';
import { createTestApp } from './create-test-app.js';
import {
  api,
  createApiKey,
  createProject,
  errorOf,
  signUp,
} from './helpers.js';

describe('API keys (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;
  let projectId: string;
  let keysUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    ({ accessToken: token } = await signUp(app));
    ({ id: projectId } = await createProject(app, token));
    keysUrl = `/v1/projects/${projectId}/keys`;
  });

  it('returns the key once and stores only its hash', async () => {
    const created = await createApiKey(app, token, projectId);
    expect(created).toEqual({
      id: expect.any(String),
      key: expect.stringMatching(/^pk_[\w-]{43}$/),
      prefix: created.key.slice(0, 11),
      createdAt: expect.any(String),
      revokedAt: null,
    });

    const [stored] = await app.get<Database>(DATABASE).select().from(apiKeys);
    expect(stored?.keyHash).toMatch(/^[0-9a-f]{64}$/);

    const list = await api(app)
      .get(keysUrl)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual([
      {
        id: created.id,
        prefix: created.prefix,
        createdAt: expect.any(String),
        revokedAt: null,
      },
    ]);
  });

  it("returns 404 for another user's project", async () => {
    const { accessToken: intruder } = await signUp(app, 'intruder@example.com');

    for (const send of [
      () => api(app).post(keysUrl),
      () => api(app).get(keysUrl),
    ]) {
      const res = await send().auth(intruder, { type: 'bearer' }).expect(404);
      expect(errorOf(res).code).toBe('PROJECT_NOT_FOUND');
    }
  });
});
