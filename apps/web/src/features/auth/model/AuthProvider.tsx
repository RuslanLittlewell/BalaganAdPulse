import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { decodeAccessToken } from "@/shared/lib/index.js";
import { readTokens, writeAccessToken, writeTokens } from "@/shared/lib/index.js";
import { endSession, onSessionExpired, onTokenRenewed } from "@/shared/lib/index.js";
import { authApi, type LoginBody, type RegisterBody, type UpdateProfileBody, type UserProfile } from "../api.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthValue {
  user: AuthUser | null;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (body: UpdateProfileBody) => Promise<void>;
  loadProfile: () => Promise<UserProfile>;
  saveAvatar: (png: Blob, avatarPath: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** The signed-in user according to the stored access token. The payload of an
 * expired token still parses, which is why a name is on screen before the
 * first renewal rather than after it. */
function currentUser(): AuthUser | null {
  const { accessToken } = readTokens();
  if (!accessToken) return null;
  const payload = decodeAccessToken(accessToken);
  if (!payload) return null;
  return { id: payload.sub, name: payload.name, email: payload.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(currentUser);

  const leave = useCallback(() => {
    setUser(null);
    // Without this the next person to sign in on this laptop sees the previous
    // user's clients until React Query refetches.
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => onSessionExpired(leave), [leave]);

  // A silent renewal (see lib/auth/session.ts) writes a new access token
  // without anyone telling React; without this, `user` stays stale for the
  // rest of the session even though a perfectly good token now exists.
  useEffect(() => onTokenRenewed(() => setUser(currentUser())), []);

  const value = useMemo<AuthValue>(() => ({
    user,
    login: async (body) => {
      writeTokens(await authApi.login(body));
      setUser(currentUser());
      // Identity just changed. Without this, the next person to sign in on
      // this laptop sees the previous user's clients until React Query
      // refetches.
      queryClient.clear();
    },
    register: async (body) => {
      writeTokens(await authApi.register(body));
      setUser(currentUser());
      queryClient.clear();
    },
    logout: async () => {
      const { refreshToken } = readTokens();
      if (refreshToken) {
        // A network failure must not trap someone in a session they asked to
        // leave; the local half below runs either way.
        try {
          await authApi.logout(refreshToken);
        } catch {
          // ignored on purpose
        }
      }
      // Routes through the same teardown as an expired session, so there is
      // one path rather than two: endSession() notifies onSessionExpired
      // listeners, which is exactly `leave` below (subscribed in the effect
      // above) — calling `leave` again here directly would run it twice.
      endSession();
    },
    updateProfile: async (body) => {
      const { accessToken } = await authApi.updateProfile(body);
      writeAccessToken(accessToken);
      setUser(currentUser());
    },
    loadProfile: authApi.profile,
    saveAvatar: async (png, avatarPath) => { await authApi.saveAvatar(png, avatarPath); },
  }), [user, leave]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
