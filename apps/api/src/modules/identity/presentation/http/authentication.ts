import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import type { SessionPrincipal } from "../../domain/identity-user.js";
import { ACCESS_COOKIE, readCookie } from "./auth-cookies.js";

const SCHEME = "Bearer ";

export interface AuthenticationPort {
  authenticate(accessToken: string): Promise<SessionPrincipal>;
}

export function createAuthentication(identity: AuthenticationPort): RequestHandler {
  return function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header("authorization");
    const accessToken = header?.startsWith(SCHEME)
      ? header.slice(SCHEME.length)
      : readCookie(req, ACCESS_COOKIE);
    if (!accessToken) {
      next(new AppError("unauthorized", "Authentication required"));
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
