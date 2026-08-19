import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasSession } from "../../lib/auth/tokenStore.js";

/** Admits on the presence of a refresh token, not a valid access token: an
 * expired access token is renewable, so start-up costs no request. If the
 * refresh token turns out to be dead, the session-expiry path takes over. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!hasSession()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <>{children}</>;
}
