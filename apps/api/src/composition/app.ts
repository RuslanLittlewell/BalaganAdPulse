import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { errorHandler } from "../shared/presentation/error-handler.js";
import { createContainer, type ApiContainer } from "./create-container.js";
import { createRoutes } from "./create-routes.js";

const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../../web/dist/", import.meta.url));

export interface AppOptions {
  webDistPath?: string;
  container?: ApiContainer;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(createRoutes(options.container ?? createContainer()));

  const webDistPath = options.webDistPath ?? DEFAULT_WEB_DIST;
  if (existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

export default createApp;
