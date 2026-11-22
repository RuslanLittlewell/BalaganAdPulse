import { http } from "@/shared/lib/index.js";
import type { TokenPair } from "@/shared/lib/index.js";
import type { ModuleKey, Role } from "@adpulse/access-policy";
import type { TariffSummary } from "@/entities/tariff/index.js";

export interface ClientRegistrationBody {
  client: {
    name: string;
    fullName?: string | null;
    organization?: string | null;
    unp?: string | null;
    phone?: string | null;
    telegram?: string | null;
    email?: string | null;
    website?: string | null;
  };
  project: {
    name: string;
  };
}

export interface RegisterBody extends Partial<ClientRegistrationBody> {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
  phone?: string | null;
  telegram?: string | null;
}

export interface LoginBody {
  login: string;
  password: string;
}

export interface UpdateProfileBody {
  name: string;
  phone?: string | null;
  telegram?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

export interface UserProfile {
  name: string;
  email: string | null;
  login: string | null;
  image: string | null;
  avatarPath: string | null;
  phone: string | null;
  telegram: string | null;
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
}

export interface AuthSession {
  user: { id: string; name: string; email: string | null; login: string | null; image: string | null };
  platformAdmin: boolean;
  organization: OrganizationSummary | null;
  role: Role | null;
  membershipId: string | null;
  partner: { campaignId: string; projectId: string } | null;
  clientIds: string[];
  modules: ModuleKey[];
  tariff: TariffSummary | null;
}

const UNAUTHENTICATED = { authenticated: false };

export interface TwoFactorChallenge {
  twoFactor: { challenge: string; expiresAt: string };
}

export type SignInAnswer = TokenPair | TwoFactorChallenge;

export function isChallenge(answer: SignInAnswer): answer is TwoFactorChallenge {
  return "twoFactor" in answer;
}

export const authApi = {
  login: (body: LoginBody) => http.post<SignInAnswer>("/auth/login", body, UNAUTHENTICATED),
  completeTwoFactor: (challenge: string, code: string) =>
    http.post<TokenPair>("/auth/two-factor", { challenge, code }, UNAUTHENTICATED),
  register: (body: RegisterBody) => http.post<TokenPair>("/auth/register", body, UNAUTHENTICATED),
  logout: () => http.post<void>("/auth/logout", {}, UNAUTHENTICATED),
  resetPassword: (token: string, password: string) =>
    http.post<SignInAnswer>(`/auth/password-reset/${encodeURIComponent(token)}`, { password }, UNAUTHENTICATED),
  session: (signal?: AbortSignal) => http.get<AuthSession>("/auth/me", { signal }),
  profile: () => http.get<UserProfile>("/user/profile"),
  saveAvatar: (png: Blob, avatarPath: string) => {
    const form = new FormData();
    form.append("image", png, "avatar.png");
    form.append("avatarPath", avatarPath);
    return http.putForm<void>("/user/avatar", form);
  },
  updateProfile: (body: UpdateProfileBody) =>
    http.patch<{ accessToken: string; refreshToken?: string }>("/user/profile", body),
};

export const passwordResetApi = {
  request: (email: string) =>
    http.post<void>("/auth/password-reset", { email }, UNAUTHENTICATED),
  check: (token: string) =>
    http.get<void>(`/auth/password-reset/${encodeURIComponent(token)}`, UNAUTHENTICATED),
};

export interface TrialSignupBody {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

export const trialApi = {
  request: (body: TrialSignupBody) => http.post<void>("/trial-signups", body, UNAUTHENTICATED),
  confirm: (token: string) =>
    http.post<TokenPair>(`/trial-signups/${encodeURIComponent(token)}/confirm`, {}, UNAUTHENTICATED),
};
