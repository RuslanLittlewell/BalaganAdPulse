import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { MemberUseCases } from "#modules/members/application/member-use-cases.js";

export interface SessionPresence {
  touch(actor: ActorContext, name: string): void;
}

export function createSessionRouter(useCases: MemberUseCases, presence: SessionPresence): Router {
  const router = Router();
  router.get("/", (req: Request, res: Response, next: NextFunction) => {
    const principal = req.principal;
    if (!principal) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    useCases
      .describeSession(principal)
      .then(({ session, actor }) => {
        if (actor) presence.touch(actor, principal.name);
        res.json(session);
      })
      .catch(next);
  });
  return router;
}
