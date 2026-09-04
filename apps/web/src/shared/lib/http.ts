import { ensureFreshToken, forceRefresh } from "./auth/session.js";

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
  return fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(!isForm ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export interface RequestOptions {
  authenticated?: boolean;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const authenticated = options?.authenticated ?? true;
  const token = authenticated ? await ensureFreshToken() : null;
  let res = await send(path, init, token);

  if (authenticated && res.status === 401 && token !== null) {
    const renewed = await forceRefresh();
    res = await send(path, init, renewed);
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
  return (await res.json()) as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const token = await ensureFreshToken();
  let res = await send(path, undefined, token);
  if (res.status === 401 && token !== null) {
    res = await send(path, undefined, await forceRefresh());
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
