import { Router } from "express";
import * as controller from "./campaign.controller.js";

/** Mounted at /api/clients/:clientId/campaigns */
export const clientCampaignRouter = Router({ mergeParams: true });
clientCampaignRouter.post("/", controller.create);
clientCampaignRouter.get("/", controller.list);

/** Mounted at /api/campaigns */
export const campaignRouter = Router();
campaignRouter.get("/:id", controller.getOne);
campaignRouter.patch("/:id", controller.update);
campaignRouter.delete("/:id", controller.remove);
