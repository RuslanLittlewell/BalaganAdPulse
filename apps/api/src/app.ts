import express from "express";
import { clientRouter } from "./clients/client.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/clients", clientRouter);
  app.use(errorHandler);
  return app;
}

export default createApp;
