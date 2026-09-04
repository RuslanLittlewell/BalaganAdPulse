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
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => onSessionExpired(leave), [leave]);

  useEffect(() => {
    if (hasSession()) void loadSession().catch(() => endSession());
  }, [loadSession]);

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
        try {
          await authApi.logout();
        } catch {
        }
      }
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
