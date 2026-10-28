import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ClientAccountUseCases } from "#modules/client-accounts/application/client-account-use-cases.js";

type ClientRequest = Request<{ clientId: string }>;

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle(action: (req: ClientRequest, res: Response) => Promise<void>) {
  return (req: ClientRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createClientAccountRouter(useCases: ClientAccountUseCases): Router {
  const router = Router({ mergeParams: true });
  router.get("/", handle(async (req, res) => {
    res.json(await useCases.read(actorOf(req), req.params.clientId));
  }));
  router.post("/", handle(async (req, res) => {
    res.status(201).json(await useCases.create(actorOf(req), req.params.clientId));
  }));
  router.post("/password", handle(async (req, res) => {
    res.json(await useCases.reissue(actorOf(req), req.params.clientId));
  }));
  return router;
}
