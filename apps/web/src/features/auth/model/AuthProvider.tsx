import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { hasSession, writeTokens } from "@/shared/lib/index.js";
import { endSession, onSessionExpired, onTokenRenewed } from "@/shared/lib/index.js";
import { authApi, type LoginBody, type RegisterBody, type UpdateProfileBody, type UserProfile } from "../api.js";
import type { OrganizationSummary } from "../api.js";
import type { Role } from "@adpulse/access-policy";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthValue {
  user: AuthUser | null;
  organization: OrganizationSummary | null;
  role: Role | null;
  clientIds: string[];
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (body: UpdateProfileBody) => Promise<void>;
  loadProfile: () => Promise<UserProfile>;
  saveAvatar: (png: Blob, avatarPath: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** User identity is loaded from /auth/me; HttpOnly tokens are intentionally
 * unavailable to React. */
function currentUser(): AuthUser | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(currentUser);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);

  const loadSession = useCallback(async () => {
    const session = await authApi.session();
    setUser(session.user);
    setOrganization(session.organization);
    setRole(session.role);
    setClientIds(session.clientIds);
  }, []);

  const leave = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setRole(null);
    setClientIds([]);
    // Without this the next person to sign in on this laptop sees the previous
    // user's clients until React Query refetches.
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => onSessionExpired(leave), [leave]);

  useEffect(() => {
    if (hasSession()) void loadSession().catch(() => endSession());
  }, [loadSession]);

  // Profile data may change together with a renewed access cookie.
  useEffect(() => onTokenRenewed(() => {
    void loadSession().catch(() => {});
  }), [loadSession]);

  const value = useMemo<AuthValue>(() => ({
    user,
    organization,
    role,
    clientIds,
    login: async (body) => {
      writeTokens(await authApi.login(body));
      // Identity just changed. Without this, the next person to sign in on
      // this laptop sees the previous user's clients until React Query
      // refetches.
      queryClient.clear();
      await loadSession();
    },
    register: async (body) => {
      writeTokens(await authApi.register(body));
      queryClient.clear();
      await loadSession();
    },
    logout: async () => {
      if (hasSession()) {
        // A network failure must not trap someone in a session they asked to
        // leave; the local half below runs either way.
        try {
          await authApi.logout();
        } catch {
          // ignored on purpose
        }
      }
      // Routes through the same teardown as an expired session, so there is
      // one path rather than two: endSession() notifies onSessionExpired
      // listeners, which is exactly `leave` below (subscribed in the effect
      // above) — calling `leave` again here directly would run it twice.
      //
      // Forced, because this *is* the ending: the request above may already
      // have cleared the markers endSession would otherwise look for, and a
      // sign-out that quietly does nothing is the worst outcome there is.
      endSession({ force: true });
    },
    updateProfile: async (body) => {
      await authApi.updateProfile(body);
      await loadSession();
    },
    loadProfile: authApi.profile,
    saveAvatar: async (png, avatarPath) => { await authApi.saveAvatar(png, avatarPath); },
  }), [user, organization, role, clientIds, loadSession, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
