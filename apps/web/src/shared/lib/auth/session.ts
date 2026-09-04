import { clearTokens, hasSession } from "./tokenStore.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

/** Thrown when a refresh attempt fails for a reason that does not mean the
 * session is dead — a rate limit, a transient 5xx during a deploy, and so
 * on. The refresh token is left in place so a caller can retry; unlike
 * SessionExpiredError, this must never clear tokens or notify listeners. */
export class RefreshUnavailableError extends Error {
  constructor(status: number) {
    super(`Refresh failed with status ${status}`);
    this.name = "RefreshUnavailableError";
  }
}

const listeners = new Set<() => void>();
const renewalListeners = new Set<(accessToken: string) => void>();

/** Returns an unsubscribe function, so a component can clean up on unmount. */
export function onSessionExpired(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fired after a silent renewal writes a fresh access token, so a component
 * holding a derived value (the signed-in user) knows to re-derive it. Same
 * shape as onSessionExpired: returns an unsubscribe function for cleanup. */
export function onTokenRenewed(listener: (accessToken: string) => void): () => void {
  renewalListeners.add(listener);
  return () => renewalListeners.delete(listener);
}

export interface EndSessionOptions {
  /**
   * Run the teardown even when no marker is left to find.
   *
   * For a deliberate sign-out, which is not the case the guard below exists for.
   * A successful sign-out clears the session cookie server-side, in its own
   * response — so on a browser holding only that cookie (Safari clears
   * localStorage by itself after a week idle), asking "is there still a session?"
   * answers no, and signing out *successfully* looked exactly like a session that
   * had already ended: the teardown was skipped, nothing navigated, and the
   * screen kept the session the visitor had just asked to leave.
   */
  force?: boolean;
}

/**
 * Clears the session and tells every subscriber.
 *
 * Idempotent for the reactive path: two requests that both 401 around the same
 * time can each reach this independently (the second after the first's inFlight
 * promise has already settled and been reset), and a session that has already
 * ended must not end — and notify — a second time. That guard reads the markers,
 * which is right when the question is "did something else already end this",
 * and wrong when the caller *is* the ending. Hence `force`.
 */
export function endSession(options?: EndSessionOptions): void {
  if (!options?.force && !hasSession()) return;
  clearTokens();
  listeners.forEach((listener) => listener());
}

function endSessionAndFail(): never {
  endSession();
  throw new SessionExpiredError();
}

/** Renewal in progress, shared by every caller. Several simultaneous 401s
 * must produce one refresh-cookie request. */
let inFlight: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  if (!hasSession()) endSessionAndFail();
  // A bare fetch on purpose: going through lib/http.ts would make this call's
  // own 401 trigger a renewal, which would trigger a renewal.
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: "{}",
  });
  // Only 401/403 mean the session itself is dead. Before the per-address
  // rate limiter this phase added, refresh could only answer 200 or 401, so
  // "not ok" and "session is dead" were the same thing — they no longer
  // are. A 429 (or a transient 502/503 during a deploy) is not a verdict on
  // this refresh token, and must not destroy it.
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

/** Returns only an opaque session signal. The actual token never enters
 * JavaScript and is attached by the browser as an HttpOnly cookie. */
export async function ensureFreshToken(): Promise<string | null> {
  return hasSession() ? "cookie-session" : null;
}
