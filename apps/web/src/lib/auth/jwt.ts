export interface AccessTokenPayload {
  sub: string;
  name: string;
  email: string;
  /** Seconds since the epoch, as JWT defines it. */
  exp: number;
}

/** Renew this many milliseconds early, so a token that is valid at the moment
 * of the check cannot expire while the request is in flight. */
const SKEW_MS = 30_000;

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

/**
 * Reads the payload. This is not verification and must never be treated as
 * such: the signature is not checked here, and the server is the only thing
 * that decides whether a token is good. The payload of an expired token is
 * still readable, which is what lets the sidebar show a name before the first
 * renewal.
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload = decodeSegment(segments[1]) as Partial<AccessTokenPayload>;
    const { sub, name, email, exp } = payload;
    if (!sub || !name || !email || typeof exp !== "number") return null;
    return { sub, name, email, exp };
  } catch {
    return null;
  }
}

export function isExpired(payload: AccessTokenPayload, now: number = Date.now()): boolean {
  return payload.exp * 1000 - SKEW_MS <= now;
}
