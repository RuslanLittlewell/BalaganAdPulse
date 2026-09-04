import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { MemberUseCases } from "../../application/member-use-cases.js";

export function createSessionRouter(useCases: MemberUseCases): Router {
  const router = Router();
  router.get("/", (req: Request, res: Response, next: NextFunction) => {
    const actor = req.actor;
    if (!actor) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    useCases.describeSession(actor).then((session) => res.json(session)).catch(next);
  });
  return router;
}
