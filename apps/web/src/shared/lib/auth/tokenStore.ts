const LEGACY_KEYS = ["admin_credentials", "adpulse.accessToken", "adpulse.refreshToken"];
const SESSION_MARKER_KEY = "adpulse.hasSession";
/** Set by the API without HttpOnly, so routing can read it before any request. */
const SESSION_COOKIE_NAME = "adpulse_session";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function removeLegacyStorage(): void {
  if (typeof localStorage === "undefined") return;
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

// Run once on application startup as well as on every public operation, so an
// old deployment's credentials disappear even before the user signs in again.
removeLegacyStorage();

/** Tokens are deliberately unreadable to the browser; this compatibility
 * function remains temporarily while callers migrate away from TokenPair. */
export function readTokens(): Partial<TokenPair> {
  removeLegacyStorage();
  return {};
}

export function writeTokens(pair: TokenPair): void {
  void pair;
  removeLegacyStorage();
  localStorage.setItem(SESSION_MARKER_KEY, "1");
}

export function writeAccessToken(token: string): void {
  void token;
  removeLegacyStorage();
}

/**
 * Both halves of the marker, not just the local one.
 *
 * `hasSession()` answers true from either source, so clearing one and leaving
 * the other lets a signed-out visitor walk straight back in. The cookie is
 * deliberately readable by the browser, which means the browser can also expire
 * it — and must, because the request that would have cleared it server-side is
 * exactly the one that may have failed.
 */
export function clearTokens(): void {
  removeLegacyStorage();
  localStorage.removeItem(SESSION_MARKER_KEY);
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}

/** A non-sensitive marker lets routing avoid a flash of the login page. The
 * API still validates the HttpOnly cookie on every protected request. */
export function hasSession(): boolean {
  removeLegacyStorage();
  return localStorage.getItem(SESSION_MARKER_KEY) === "1"
    || (typeof document !== "undefined"
      && new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=1(?:;|$)`).test(document.cookie));
}
