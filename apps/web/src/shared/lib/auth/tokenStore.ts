const LEGACY_KEYS = ["admin_credentials", "adpulse.accessToken", "adpulse.refreshToken"];
const SESSION_MARKER_KEY = "adpulse.hasSession";

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

export function clearTokens(): void {
  removeLegacyStorage();
  localStorage.removeItem(SESSION_MARKER_KEY);
}

/** A non-sensitive marker lets routing avoid a flash of the login page. The
 * API still validates the HttpOnly cookie on every protected request. */
export function hasSession(): boolean {
  removeLegacyStorage();
  return localStorage.getItem(SESSION_MARKER_KEY) === "1"
    || (typeof document !== "undefined" && /(?:^|;\s*)adpulse_session=1(?:;|$)/.test(document.cookie));
}
