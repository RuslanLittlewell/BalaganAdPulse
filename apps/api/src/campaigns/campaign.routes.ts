import { Router } from "express";
import * as controller from "./campaign.controller.js";

/** Mounted at /api/projects/:projectId/campaigns */
export const projectCampaignRouter = Router({ mergeParams: true });
projectCampaignRouter.post("/", controller.create);
projectCampaignRouter.get("/", controller.list);

/** Mounted at /api/campaigns */
export const campaignRouter = Router();
campaignRouter.get("/:id", controller.getOne);
campaignRouter.patch("/:id", controller.update);
campaignRouter.delete("/:id", controller.remove);
