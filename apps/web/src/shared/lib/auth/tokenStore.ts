const LEGACY_KEYS = ["admin_credentials", "adpulse.accessToken", "adpulse.refreshToken"];
const SESSION_MARKER_KEY = "adpulse.hasSession";
const SESSION_COOKIE_NAME = "adpulse_session";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function removeLegacyStorage(): void {
  if (typeof localStorage === "undefined") return;
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

removeLegacyStorage();

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
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}

export function hasSession(): boolean {
  removeLegacyStorage();
  return localStorage.getItem(SESSION_MARKER_KEY) === "1"
    || (typeof document !== "undefined"
      && new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=1(?:;|$)`).test(document.cookie));
}
