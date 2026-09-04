import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { CampaignUseCases } from "../../application/campaign-use-cases.js";
import type { MeasuredDay } from "../../domain/metrics.js";
import { rangeSchema } from "./campaign-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

const rangeOf = (req: Request) => rangeSchema.parse(req.query);

const asDays = (days: readonly MeasuredDay[]) =>
  days.map(({ date, ...measured }) => ({ date: date.toISOString().slice(0, 10), ...measured }));

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export interface CampaignHttpRouters {
  readonly campaignRouter: Router;
  readonly adSetRouter: Router;
  readonly projectMetricRouter: Router;
  readonly summaryRouter: Router;
}

export function createCampaignHttpRouters(useCases: CampaignUseCases): CampaignHttpRouters {
  const campaignRouter = Router();
  campaignRouter.get("/:id", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.readCampaign(actorOf(req), req.params.id, rangeOf(req)));
  }));
  campaignRouter.get("/:id/ad-sets", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.listAdSets(actorOf(req), req.params.id, rangeOf(req)));
  }));
  campaignRouter.get("/:id/daily", handle(async (req: Request<{ id: string }>, res) => {
    res.json(asDays(await useCases.dailySeries(actorOf(req), req.params.id, rangeOf(req))));
  }));

  const adSetRouter = Router();
  adSetRouter.get("/:id/ads", handle(async (req: Request<{ id: string }>, res) => {
    res.json(await useCases.listAds(actorOf(req), req.params.id, rangeOf(req)));
  }));

  const projectMetricRouter = Router({ mergeParams: true });
  projectMetricRouter.get("/campaigns/names", handle(async (req: Request<{ projectId: string }>, res) => {
    res.json(await useCases.listCampaignReferences(actorOf(req), req.params.projectId));
  }));
  projectMetricRouter.get("/campaigns", handle(async (req: Request<{ projectId: string }>, res) => {
    res.json(await useCases.listCampaigns(actorOf(req), req.params.projectId, rangeOf(req)));
  }));
  projectMetricRouter.get("/daily", handle(async (req: Request<{ projectId: string }>, res) => {
    res.json(asDays(await useCases.projectDailySeries(actorOf(req), req.params.projectId, rangeOf(req))));
  }));
  projectMetricRouter.get("/summary", handle(async (req: Request<{ projectId: string }>, res) => {
    res.json(await useCases.projectSummary(actorOf(req), req.params.projectId, rangeOf(req)));
  }));

  const summaryRouter = Router();
  summaryRouter.get("/channels", handle(async (req, res) => {
    res.json(await useCases.channelSummary(actorOf(req), rangeOf(req)));
  }));
  summaryRouter.get("/", handle(async (req, res) => {
    res.json(await useCases.agencySummary(actorOf(req), rangeOf(req)));
  }));

  return { campaignRouter, adSetRouter, projectMetricRouter, summaryRouter };
}
