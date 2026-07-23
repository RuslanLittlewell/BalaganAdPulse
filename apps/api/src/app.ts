import express from "express";
import { clientRouter } from "./clients/client.routes.js";
import { campaignRouter, clientCampaignRouter } from "./campaigns/campaign.routes.js";
import { campaignPropertyRouter, propertyRouter } from "./properties/property.routes.js";
import { campaignRecordRouter, recordRouter } from "./records/record.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/clients/:clientId/campaigns", clientCampaignRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/campaigns/:campaignId/properties", campaignPropertyRouter);
  app.use("/api/campaigns/:campaignId/records", campaignRecordRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/properties", propertyRouter);
  app.use("/api/records", recordRouter);
  app.use(errorHandler);
  return app;
}

export default createApp;
