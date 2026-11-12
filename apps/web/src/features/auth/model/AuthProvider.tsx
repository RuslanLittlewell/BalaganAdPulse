import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, hasSession, writeTokens } from "@/shared/lib/index.js";
import { endSession, onSessionExpired, onTokenRenewed } from "@/shared/lib/index.js";
import { authApi, type LoginBody, type RegisterBody, type UpdateProfileBody, type UserProfile } from "../api.js";
import type { OrganizationSummary } from "../api.js";
import type { ModuleKey, Role } from "@adpulse/access-policy";
import type { TariffSummary } from "@/entities/tariff/index.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  login: string | null;
}

interface AuthValue {
  user: AuthUser | null;
  organization: OrganizationSummary | null;
  role: Role | null;
  membershipId: string | null;
  clientIds: string[];
  platformAdmin: boolean;
  modules: ModuleKey[];
  tariff: TariffSummary | null;
  sessionError: boolean;
  retrySession: () => void;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
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
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [tariff, setTariff] = useState<TariffSummary | null>(null);

  const [sessionError, setSessionError] = useState(false);
  const generation = useRef(0);
  const sessionRequest = useRef<AbortController | null>(null);
  const invalidateSession = useCallback(() => {
    generation.current += 1;
    sessionRequest.current?.abort();
    sessionRequest.current = null;
  }, []);

  const loadSession = useCallback(async () => {
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    const current = generation.current;
    let session;
    try {
      session = await authApi.session(controller.signal);
    } catch (error) {
      if (current !== generation.current || controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) endSession();
      else setSessionError(true);
      throw error;
    }
    if (current !== generation.current || controller.signal.aborted) return;
    setSessionError(false);
    setUser(session.user);
    setOrganization(session.organization);
    setRole(session.role);
    setMembershipId(session.membershipId ?? null);
    setClientIds(session.clientIds);
    setPlatformAdmin(session.platformAdmin);
    setModules(session.modules);
    setTariff(session.tariff ?? null);
  }, []);

  const leave = useCallback(() => {
    invalidateSession();
    setSessionError(false);
    setUser(null);
    setOrganization(null);
    setRole(null);
    setMembershipId(null);
    setClientIds([]);
    setPlatformAdmin(false);
    setModules([]);
    setTariff(null);
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient, invalidateSession]);

  useEffect(() => onSessionExpired(leave), [leave]);

  useEffect(() => {
    if (hasSession()) void loadSession().catch(() => {});
    return invalidateSession;
  }, [loadSession, invalidateSession]);

  useEffect(() => onTokenRenewed(() => {
    void loadSession().catch(() => {});
  }), [loadSession]);

  const value = useMemo<AuthValue>(() => ({
    user,
    organization,
    role,
    membershipId,
    clientIds,
    platformAdmin,
    modules,
    tariff,
    sessionError,
    retrySession: () => { void loadSession().catch(() => {}); },
    login: async (body) => {
      invalidateSession();
      const current = generation.current;
      const tokens = await authApi.login(body);
      if (current !== generation.current) return;
      writeTokens(tokens);
      queryClient.clear();
      await loadSession();
    },
    register: async (body) => {
      invalidateSession();
      const current = generation.current;
      const tokens = await authApi.register(body);
      if (current !== generation.current) return;
      writeTokens(tokens);
      queryClient.clear();
      await loadSession();
    },
    resetPassword: async (token, password) => {
      invalidateSession();
      const current = generation.current;
      const tokens = await authApi.resetPassword(token, password);
      if (current !== generation.current) return;
      writeTokens(tokens);
      queryClient.clear();
      await loadSession();
    },
    logout: async () => {
      invalidateSession();
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
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
    loadProfile: authApi.profile,
    saveAvatar: async (png, avatarPath) => { await authApi.saveAvatar(png, avatarPath); },
  }), [user, organization, role, membershipId, clientIds, platformAdmin, modules, tariff, sessionError, loadSession, invalidateSession, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const signedOut = () => Promise.reject(new Error("A shared view has no session"));

export function SharedAuthProvider({ modules, children }: { modules: ModuleKey[]; children: ReactNode }) {
  const value = useMemo<AuthValue>(() => ({
    user: null,
    organization: null,
    role: null,
    membershipId: null,
    clientIds: [],
    platformAdmin: false,
    modules,
    tariff: null,
    sessionError: false,
    retrySession: () => {},
    login: signedOut,
    register: signedOut,
    resetPassword: signedOut,
    logout: signedOut,
    updateProfile: signedOut,
    loadProfile: signedOut,
    saveAvatar: signedOut,
  }), [modules]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function useModuleEnabled(module: ModuleKey): boolean {
  return useAuth().modules.includes(module);
}
