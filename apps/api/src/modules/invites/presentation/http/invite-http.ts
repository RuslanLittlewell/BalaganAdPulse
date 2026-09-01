import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { InviteUseCases } from "../../application/invite-use-cases.js";
import { createInviteSchema } from "./invite-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createInviteRouter(useCases: InviteUseCases): Router {
  const router = Router();
  router.post("/", handle(async (req, res) => {
    const input = createInviteSchema.parse(req.body);
    res.status(201).json(await useCases.create(actorOf(req), input));
  }));
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.list(actorOf(req)));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.revoke(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}
