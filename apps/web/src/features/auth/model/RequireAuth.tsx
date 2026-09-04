import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasSession } from "@/shared/lib/index.js";

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
