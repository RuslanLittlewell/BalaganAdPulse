import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import type { SessionPrincipal } from "../../domain/identity-user.js";

const SCHEME = "Bearer ";

/** The single identity capability this middleware needs. Narrower than the full
 * use-case surface on purpose: authentication should not be able to reach
 * registration or profile updates just because it lives in the same module. */
export interface AuthenticationPort {
  authenticate(accessToken: string): Promise<SessionPrincipal>;
}

/**
 * Turns a bearer token into the `SessionPrincipal` the rest of the request
 * works from. It establishes *who* is calling; which organization they are in
 * and what they may do there is the membership middleware's question.
 *
 * A missing or non-Bearer header is refused here without troubling the port —
 * there is no token to verify — and every rejected token is refused the same
 * way whatever was wrong with it, so expired, tampered and unknown are
 * indistinguishable from outside.
 */
export function createAuthentication(identity: AuthenticationPort): RequestHandler {
  return function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header("authorization");
    if (!header?.startsWith(SCHEME)) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    identity
      .authenticate(header.slice(SCHEME.length))
      .then((principal) => {
        req.principal = principal;
        next();
      })
      .catch(next);
  };
}
