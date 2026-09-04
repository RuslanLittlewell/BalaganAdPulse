import { http } from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import type { TokenPair } from "@/shared/lib/index.js";
import type { Role } from "@adpulse/access-policy";

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
    niche?: string | null;
    monthlyBudget?: number | null;
    budgetCurrency?: Currency;
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
  email: string;
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
  email: string;
  image: string | null;
  avatarPath: string | null;
  phone: string | null;
  telegram: string | null;
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

const UNAUTHENTICATED = { authenticated: false };

export const authApi = {
  login: (body: LoginBody) => http.post<TokenPair>("/auth/login", body, UNAUTHENTICATED),
  register: (body: RegisterBody) => http.post<TokenPair>("/auth/register", body, UNAUTHENTICATED),
  logout: () => http.post<void>("/auth/logout", {}, UNAUTHENTICATED),
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
