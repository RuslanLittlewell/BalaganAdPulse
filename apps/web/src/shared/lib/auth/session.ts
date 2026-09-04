import { clearTokens, hasSession } from "./tokenStore.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export class RefreshUnavailableError extends Error {
  constructor(status: number) {
    super(`Refresh failed with status ${status}`);
    this.name = "RefreshUnavailableError";
  }
}

const listeners = new Set<() => void>();
const renewalListeners = new Set<(accessToken: string) => void>();

export function onSessionExpired(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onTokenRenewed(listener: (accessToken: string) => void): () => void {
  renewalListeners.add(listener);
  return () => renewalListeners.delete(listener);
}

export interface EndSessionOptions {
  force?: boolean;
}

export function endSession(options?: EndSessionOptions): void {
  if (!options?.force && !hasSession()) return;
  clearTokens();
  listeners.forEach((listener) => listener());
}

function endSessionAndFail(): never {
  endSession();
  throw new SessionExpiredError();
}

let inFlight: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  if (!hasSession()) endSessionAndFail();
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: "{}",
  });
  if (res.status === 401 || res.status === 403) endSessionAndFail();
  if (!res.ok) throw new RefreshUnavailableError(res.status);
  await res.json();
  renewalListeners.forEach((listener) => listener("cookie-session"));
  return "cookie-session";
}

export function forceRefresh(): Promise<string> {
  if (!inFlight) {
    inFlight = runRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function ensureFreshToken(): Promise<string | null> {
  return hasSession() ? "cookie-session" : null;
}
