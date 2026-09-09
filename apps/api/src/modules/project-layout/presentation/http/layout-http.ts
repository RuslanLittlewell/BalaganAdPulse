import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ProjectLayoutUseCases } from "../../application/layout-use-cases.js";
import { groupSchema, layoutSchema } from "./layout-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createProjectLayoutRouter(useCases: ProjectLayoutUseCases): Router {
  const router = Router();
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.read(actorOf(req)));
  }));
  router.put("/", handle(async (req, res) => {
    res.json(await useCases.replace(actorOf(req), layoutSchema.parse(req.body)));
  }));
  return router;
}

export function createProjectGroupRouter(useCases: ProjectLayoutUseCases): Router {
  const router = Router();
  router.post("/", handle(async (req, res) => {
    res.status(201).json(await useCases.createGroup(actorOf(req), groupSchema.parse(req.body).name));
  }));
  router.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.deleteGroup(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}
