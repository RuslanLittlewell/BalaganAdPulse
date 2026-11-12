import { ensureFreshToken, forceRefresh } from "./auth/session.js";
import { sharedToken } from "./shareScope.js";

export class ApiError extends Error {
  status: number;
  details: unknown[];

  constructor(message: string, status: number, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface ErrorEnvelope {
  error?: { message?: string; details?: unknown[] };
}

async function send(path: string, init: RequestInit | undefined, _token: string | null) {
  const isForm = init?.body instanceof FormData;
  const shared = sharedToken();
  return fetch(`/api${shared === null ? "" : `/shared/${encodeURIComponent(shared)}`}${path}`, {
    ...init,
    credentials: shared === null ? "include" : "omit",
    headers: {
      ...(!isForm ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export interface RequestOptions {
  authenticated?: boolean;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const authenticated = sharedToken() === null && (options?.authenticated ?? true);
  const requestInit = { ...init, signal: options?.signal };
  const token = authenticated ? await ensureFreshToken() : null;
  let res = await send(path, requestInit, token);

  if (authenticated && res.status === 401 && token !== null) {
    options?.signal?.throwIfAborted();
    const renewed = await forceRefresh();
    res = await send(path, requestInit, renewed);
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let details: unknown[] = [];
    try {
      const body = (await res.json()) as ErrorEnvelope;
      if (body.error?.message) message = body.error.message;
      if (Array.isArray(body.error?.details)) details = body.error.details;
    } catch {
    }
    throw new ApiError(message, res.status, details);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function requestBlob(path: string, options?: RequestOptions): Promise<Blob> {
  const token = sharedToken() === null ? await ensureFreshToken() : null;
  const init = { signal: options?.signal };
  let res = await send(path, init, token);
  if (res.status === 401 && token !== null) {
    options?.signal?.throwIfAborted();
    res = await send(path, init, await forceRefresh());
  }
  if (!res.ok) {
    throw new ApiError(res.statusText || "Request failed", res.status);
  }
  return res.blob();
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, undefined, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, options),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, options),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, options),
  putForm: <T>(path: string, body: FormData) => request<T>(path, { method: "PUT", body }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
  getBlob: requestBlob,
  del: (path: string, options?: RequestOptions) => request<void>(path, { method: "DELETE" }, options),
};
