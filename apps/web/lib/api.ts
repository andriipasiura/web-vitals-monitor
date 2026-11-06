export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { path?: string; message?: string }[];
  };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let unauthorizedHandler = () => {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasSession(): boolean {
  return accessToken !== null;
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      accessToken = res.ok
        ? ((await res.json()) as { accessToken: string }).accessToken
        : null;
      return res.ok;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
  });
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  const detail = body.error?.details?.[0];
  const message = detail?.message
    ? `${detail.path ? `${detail.path}: ` : ''}${detail.message}`
    : (body.error?.message ?? res.statusText);
  return new ApiError(res.status, body.error?.code ?? 'HTTP_ERROR', message);
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const sent = accessToken;
  let res = await send(path, options, sent);

  if (res.status === 401 && options.auth !== false) {
    const renewed = accessToken !== sent || (await refreshSession());
    if (renewed) res = await send(path, options, accessToken);
    if (res.status === 401) unauthorizedHandler();
  }

  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
