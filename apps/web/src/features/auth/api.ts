import { http } from "@/shared/lib/index.js";
import type { TokenPair } from "@/shared/lib/index.js";
import type { Role } from "@adpulse/access-policy";

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

export interface UpdateProfileBody {
  name: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  /** A `data:` URL, ready for an `<img src>` — or null when none is set. */
  image: string | null;
  avatarPath: string | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSession {
  user: { id: string; name: string; email: string; image: string | null };
  organization: OrganizationSummary;
  role: Role;
  clientIds: string[];
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
  session: () => http.get<AuthSession>("/auth/me"),
  profile: () => http.get<UserProfile>("/user/profile"),
  saveAvatar: (png: Blob, avatarPath: string) => {
    const form = new FormData();
    form.append("image", png, "avatar.png");
    form.append("avatarPath", avatarPath);
    return http.putForm<void>("/user/avatar", form);
  },
  updateProfile: (body: UpdateProfileBody) =>
    http.patch<{ accessToken: string }>("/user/profile", body),
};
