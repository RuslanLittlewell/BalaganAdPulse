import type { NextFunction, Request, Response } from "express";
import { createCampaignSchema, updateCampaignSchema } from "./campaign.schema.js";
import {
  createCampaign, listCampaigns, getCampaignTable, updateCampaign, deleteCampaign,
} from "./campaign.service.js";

export async function create(
  req: Request<{ clientId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createCampaignSchema.parse(req.body);
    res.status(201).json(await createCampaign(req.params.clientId, data));
  } catch (e) { next(e); }
}

export async function list(
  req: Request<{ clientId: string }>, res: Response, next: NextFunction,
) {
  try {
    res.json(await listCampaigns(req.params.clientId));
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await getCampaignTable(req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateCampaignSchema.parse(req.body);
    res.json(await updateCampaign(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteCampaign(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
