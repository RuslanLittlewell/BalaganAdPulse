import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { OptionalModule } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/app-error.js";
import type { ActorContext } from "#shared/application/index.js";

export interface ModuleEntitlements {
  isEntitled(actor: ActorContext, module: OptionalModule): Promise<boolean>;
}

export function createModuleGate(entitlements: ModuleEntitlements) {
  return function requireModule(module: OptionalModule): RequestHandler {
    return function gate(req: Request, _res: Response, next: NextFunction): void {
      const actor = req.actor;
      if (!actor) {
        next(new AppError("unauthorized", "Authentication required"));
        return;
      }
      entitlements
        .isEntitled(actor, module)
        .then((entitled) => next(entitled ? undefined : new AppError("not-found", "Endpoint not found")))
        .catch(next);
    };
  };
}
