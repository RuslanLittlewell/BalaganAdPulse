import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { SummaryOwner } from "#modules/summary-tiles/domain/summary-tiles.js";
import type { SummaryTileUseCases } from "#modules/summary-tiles/application/summary-tile-use-cases.js";
import { summaryTilesSchema } from "./summary-tile-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createSummaryTileRouter(useCases: SummaryTileUseCases): Router {
  const router = Router();
  const owners: Array<[string, (req: Request<{ id?: string }>) => SummaryOwner]> = [
    ["/dashboard/summary-tiles", () => ({ kind: "dashboard" })],
    ["/projects/:id/summary-tiles", (req) => ({ kind: "project", id: req.params.id! })],
  ];
  for (const [path, ownerOf] of owners) {
    router.get(path, handle(async (req: Request<{ id?: string }>, res) => {
      res.json({ tiles: await useCases.read(actorOf(req), ownerOf(req)) });
    }));
    router.put(path, handle(async (req: Request<{ id?: string }>, res) => {
      const { tiles } = summaryTilesSchema.parse(req.body);
      res.json({ tiles: await useCases.choose(actorOf(req), ownerOf(req), tiles) });
    }));
  }
  return router;
}
