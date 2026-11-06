import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('./api');

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const authOf = (call: unknown[]) =>
  (call[1] as RequestInit).headers as Record<string, string>;

describe('api refresh and retry', () => {
  let client: Api;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = await import('./api');
    client.setAccessToken('old');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(client.api('/v1/projects')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/v1\/auth\/refresh$/);
    expect(authOf(fetchMock.mock.calls[0]!).Authorization).toBe('Bearer old');
    expect(authOf(fetchMock.mock.calls[2]!).Authorization).toBe('Bearer new');
  });

  it('shares one refresh between concurrent 401s', async () => {
    let resolveRefresh!: (res: Response) => void;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return new Promise<Response>((resolve) => (resolveRefresh = resolve));
      }
      const auth = init.headers as Record<string, string>;
      return Promise.resolve(
        auth.Authorization === 'Bearer new' ? json(200, { url }) : json(401),
      );
    });

    const requests = Promise.all([client.api('/a'), client.api('/b')]);
    await vi.waitFor(() => expect(resolveRefresh).toBeDefined());
    resolveRefresh(json(200, { accessToken: 'new' }));

    await expect(requests).resolves.toHaveLength(2);
    const refreshes = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/v1/auth/refresh'),
    );
    expect(refreshes).toHaveLength(1);
  });

  it('does not retry when the refresh fails and reports unauthorized', async () => {
    const unauthorized = vi.fn();
    client.onUnauthorized(unauthorized);
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));

    await expect(client.api('/v1/projects')).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(client.hasSession()).toBe(false);
  });

  it('retries only once when the retry is also 401', async () => {
    const unauthorized = vi.fn();
    client.onUnauthorized(unauthorized);
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(json(401));

    await expect(client.api('/v1/projects')).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('retries without refreshing when another request already renewed the token', async () => {
    fetchMock.mockImplementationOnce(async () => {
      client.setAccessToken('new');
      return json(401);
    });
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(client.api('/v1/projects')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authOf(fetchMock.mock.calls[1]!).Authorization).toBe('Bearer new');
  });

  it('does not refresh for unauthenticated calls', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Nope' } }),
    );

    await expect(
      client.api('/v1/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new refresh after the previous one settled', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { accessToken: 'a' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'b' }));

    await client.refreshSession();
    await client.refreshSession();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
