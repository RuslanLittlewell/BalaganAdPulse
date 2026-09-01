import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { errorHandler } from "../shared/presentation/error-handler.js";
import { createContainer } from "./create-container.js";
import { createRoutes } from "./create-routes.js";

/** Resolves to `apps/web/dist` from both `apps/api/src/app.ts` and the compiled
 * `apps/api/dist/app.js`, since each sits one directory below `apps/api`. */
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist/", import.meta.url));

export interface AppOptions {
  /** Overridden by tests so the API suite never needs a real Vite build. */
  webDistPath?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(createRoutes(createContainer()));

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
