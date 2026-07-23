import { Router } from "express";
import * as controller from "./property.controller.js";

/** Mounted at /api/campaigns/:campaignId/properties */
export const campaignPropertyRouter = Router({ mergeParams: true });
campaignPropertyRouter.post("/", controller.create);

/** Mounted at /api/properties */
export const propertyRouter = Router();
propertyRouter.patch("/:id", controller.update);
propertyRouter.delete("/:id", controller.remove);
