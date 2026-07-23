import { Router } from "express";
import * as controller from "./record.controller.js";
import * as valueController from "./value.controller.js";

/** Mounted at /api/campaigns/:campaignId/records */
export const campaignRecordRouter = Router({ mergeParams: true });
campaignRecordRouter.post("/", controller.create);

/** Mounted at /api/records */
export const recordRouter = Router();
recordRouter.patch("/:id", controller.update);
recordRouter.delete("/:id", controller.remove);
recordRouter.put("/:recordId/values/:propertyId", valueController.set);
