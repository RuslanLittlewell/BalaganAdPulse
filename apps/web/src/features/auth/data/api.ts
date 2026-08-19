import { http } from "../../../lib/http.js";
import type { TokenPair } from "../../../lib/auth/tokenStore.js";

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

// These three calls opt out of both renewal behaviours in lib/http.ts: they
// must reach the server before any token check, and their own 401 (a wrong
// password) must be answered once, not repeated as if it were a stale token.
const UNAUTHENTICATED = { authenticated: false };

export const authApi = {
  login: (body: LoginBody) => http.post<TokenPair>("/auth/login", body, UNAUTHENTICATED),
  register: (body: RegisterBody) => http.post<TokenPair>("/auth/register", body, UNAUTHENTICATED),
  logout: (refreshToken: string) =>
    http.post<void>("/auth/logout", { refreshToken }, UNAUTHENTICATED),
};
