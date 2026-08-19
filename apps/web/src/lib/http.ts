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

async function send(path: string, init: RequestInit | undefined, token: string | null) {
  return fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
      // Last, so a caller-supplied header can never unset the token.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export interface RequestOptions {
  /** False for the open auth endpoints (login, register, logout): they must
   * not trigger a renewal ahead of the request, and their own 401 is a
   * real answer (wrong credentials) rather than a stale-token signal, so it
   * must not be repeated. Defaults to true. */
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

  // The check above trusts the browser's clock; a clock off by minutes makes an
  // expired token look fresh. Repeating is safe because a 401 comes from the
  // guard, before the request reaches any service, so nothing happened that a
  // repeat would happen twice. The body is a string, so it can be sent again.
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
      // non-JSON error body; keep the status-based message
    }
    throw new ApiError(message, res.status, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, undefined, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, options),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, options),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, options),
  del: (path: string, options?: RequestOptions) => request<void>(path, { method: "DELETE" }, options),
};
