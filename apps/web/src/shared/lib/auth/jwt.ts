export interface AccessTokenPayload {
  sub: string;
  name: string;
  email: string;
  exp: number;
}

const SKEW_MS = 30_000;

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

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
