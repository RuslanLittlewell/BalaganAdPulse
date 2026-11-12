import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ShareLinkUseCases } from "#modules/share-links/application/share-link-use-cases.js";
import { issueShareLinkSchema } from "./share-link-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createShareLinkRouter(links: ShareLinkUseCases): Router {
  const router = Router();
  router.get("/:id/share-link", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await links.read(actorOf(req), req.params.id));
  }));
  router.put("/:id/share-link", handle(async (req: Request<{ id: string }>, res) => {
    const { renew } = issueShareLinkSchema.parse(req.body ?? {});
    const { link, created } = await links.issue(actorOf(req), req.params.id, renew);
    res.status(created ? 201 : 200).json(link);
  }));
  router.delete("/:id/share-link", handle(async (req: Request<{ id: string }>, res) => {
    await links.remove(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}
