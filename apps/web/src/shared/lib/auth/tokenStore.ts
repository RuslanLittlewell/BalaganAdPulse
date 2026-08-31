const ACCESS_KEY = "adpulse.accessToken";
const REFRESH_KEY = "adpulse.refreshToken";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Always read at the moment of use rather than cached at module load, so a
 * sign-in in this tab is visible to every later call. */
export function readTokens(): Partial<TokenPair> {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  return {
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
}

export function writeTokens(pair: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, pair.accessToken);
  localStorage.setItem(REFRESH_KEY, pair.refreshToken);
}

export function writeAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** The refresh token is what decides this, not the access token: an expired
 * access token is renewable, a missing refresh token is not. */
export function hasSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null;
}
