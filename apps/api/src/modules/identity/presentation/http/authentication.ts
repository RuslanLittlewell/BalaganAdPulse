import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "#shared/domain/app-error.js";
import { isForeignOrigin } from "#shared/application/index.js";
import type { SessionPrincipal } from "#modules/identity/domain/identity-user.js";
import { ACCESS_COOKIE, readCookie } from "./auth-cookies.js";

const SCHEME = "Bearer ";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CROSS_ORIGIN_REFUSED = "Cross-origin request refused";

function crossSite(req: Request, appOrigin: string | null): boolean {
  const origin = req.header("origin");
  if (origin !== undefined) return isForeignOrigin(origin, req.header("host"), appOrigin);
  const site = req.header("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

export interface AuthenticationPort {
  authenticate(accessToken: string): Promise<SessionPrincipal>;
}

export function createAuthentication(identity: AuthenticationPort, appOrigin: string | null = null): RequestHandler {
  return function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header("authorization");
    const bearer = header?.startsWith(SCHEME) ? header.slice(SCHEME.length) : undefined;
    const accessToken = bearer ?? readCookie(req, ACCESS_COOKIE);
    if (!accessToken) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    if (bearer === undefined && UNSAFE_METHODS.has(req.method) && crossSite(req, appOrigin)) {
      next(new AppError("forbidden", CROSS_ORIGIN_REFUSED));
      return;
    }
    identity
      .authenticate(accessToken)
      .then((principal) => {
        req.principal = principal;
        next();
      })
      .catch(next);
  };
}
