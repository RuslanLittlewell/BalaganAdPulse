import { decodeAccessToken, isExpired } from "./jwt.js";
import { clearTokens, hasSession, readTokens, writeAccessToken } from "./tokenStore.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
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

/** Clears the session and tells every subscriber. Idempotent: two requests
 * that both 401 around the same time can each reach this independently (the
 * second after the first's inFlight promise has already settled and been
 * reset), and a session that has already ended must not end — and notify —
 * a second time. */
export function endSession(): void {
  if (!hasSession()) return;
  clearTokens();
  listeners.forEach((listener) => listener());
}

function endSessionAndFail(): never {
  endSession();
  throw new SessionExpiredError();
}

/** Renewal in progress, shared by every caller. A page load with an expired
 * token fires several requests at once, and without this each of them would
 * open its own renewal. */
let inFlight: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  const { refreshToken } = readTokens();
  if (!refreshToken) endSessionAndFail();
  // A bare fetch on purpose: going through lib/http.ts would make this call's
  // own 401 trigger a renewal, which would trigger a renewal.
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) endSessionAndFail();
  const { accessToken } = (await res.json()) as { accessToken: string };
  writeAccessToken(accessToken);
  renewalListeners.forEach((listener) => listener(accessToken));
  return accessToken;
}

export function forceRefresh(): Promise<string> {
  if (!inFlight) {
    inFlight = runRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The token to send with the next request, renewing first if the stored one
 * is stale. `null` means there is no session and the request goes out bare —
 * which is exactly what sign-in and sign-up need. */
export async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, refreshToken } = readTokens();
  if (accessToken) {
    const payload = decodeAccessToken(accessToken);
    if (payload && !isExpired(payload)) return accessToken;
  }
  if (!refreshToken) return null;
  return forceRefresh();
}
