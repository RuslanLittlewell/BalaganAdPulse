import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { CampaignUseCases } from "../../application/campaign-use-cases.js";
import {
  createCampaignSchema,
  createPropertySchema,
  updateCampaignSchema,
  updatePropertySchema,
} from "./campaign-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createCampaignHttpRouters(useCases: CampaignUseCases) {
  /** Mounted at /api/projects/:projectId/campaigns */
  const projectCampaignRouter = Router({ mergeParams: true });
  projectCampaignRouter.post("/", handle(async (req: Request<{ projectId: string }>, res) => {
    const input = createCampaignSchema.parse(req.body);
    res.status(201).json(await useCases.create(actorOf(req), req.params.projectId, input));
  }));
  projectCampaignRouter.get("/", handle(async (req: Request<{ projectId: string }>, res) => {
    res.json(await useCases.list(actorOf(req), req.params.projectId));
  }));

  /** Mounted at /api/campaigns */
  const campaignRouter = Router();
  campaignRouter.get("/:id", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.readTable(actorOf(req), req.params.id));
  }));
  campaignRouter.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const input = updateCampaignSchema.parse(req.body);
    res.json(await useCases.update(actorOf(req), req.params.id, input));
  }));
  campaignRouter.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.delete(actorOf(req), req.params.id);
    res.status(204).send();
  }));

  /** Mounted at /api/campaigns/:campaignId/properties */
  const campaignPropertyRouter = Router({ mergeParams: true });
  campaignPropertyRouter.post("/", handle(async (req: Request<{ campaignId: string }>, res) => {
    const input = createPropertySchema.parse(req.body);
    res.status(201).json(await useCases.createProperty(actorOf(req), req.params.campaignId, input));
  }));

  /** Mounted at /api/properties */
  const propertyRouter = Router();
  propertyRouter.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const input = updatePropertySchema.parse(req.body);
    res.json(await useCases.updateProperty(actorOf(req), req.params.id, input));
  }));
  propertyRouter.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.deleteProperty(actorOf(req), req.params.id);
    res.status(204).send();
  }));

  return { projectCampaignRouter, campaignRouter, campaignPropertyRouter, propertyRouter };
}
