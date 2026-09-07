import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { PresenceService } from "../../application/presence-service.js";

export function createPresenceTouch(presence: PresenceService): RequestHandler {
  return function touchPresence(req: Request, _res: Response, next: NextFunction): void {
    if (req.actor && req.principal) presence.touch(req.actor, req.principal.name);
    next();
  };
}
