import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../../../shared/domain/app-error.js";
import type { ActorResolutionPort } from "../../application/actor-resolution-port.js";

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
