import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import type { ActorResolutionPort } from "../../application/actor-resolution-port.js";

/**
 * Resolves the authenticated principal into the `ActorContext` for the
 * organization they are acting in — membership, role and tenancy.
 *
 * The port is asked on **every** request rather than once per token. That is
 * the whole reason the role is not sealed into the access token: a demotion or
 * a suspension has to take effect on the very next call, not whenever a
 * fifteen-minute token happens to expire.
 *
 * Reaching here without a principal means the middleware were mounted out of
 * order. It answers as an unauthenticated request rather than throwing, so a
 * misordered mount fails closed.
 */
export function createActorResolution(members: ActorResolutionPort): RequestHandler {
  return function resolveActor(req: Request, _res: Response, next: NextFunction): void {
    const principal = req.principal;
    if (!principal) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    members
      .resolveActor(principal)
      .then((actor) => {
        req.actor = actor;
        next();
      })
      .catch(next);
  };
}
