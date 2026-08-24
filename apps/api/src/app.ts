import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./middleware/require-auth.js";
import { clientRouter } from "./clients/client.routes.js";
import { campaignRouter, clientCampaignRouter } from "./campaigns/campaign.routes.js";
import { campaignPropertyRouter, propertyRouter } from "./properties/property.routes.js";
import { campaignRecordRouter, recordRouter } from "./records/record.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { NotFoundError } from "./errors.js";

/** Resolves to `apps/web/dist` from both `apps/api/src/app.ts` and the compiled
 * `apps/api/dist/app.js`, since each sits one directory below `apps/api`. */
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist/", import.meta.url));

export interface AppOptions {
  /** Overridden by tests so the API suite never needs a real Vite build. */
  webDistPath?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  // Exactly one proxy sits in front of this service in production. `true` would
  // trust the whole X-Forwarded-For chain, letting any client prepend a forged
  // address and hand itself a fresh rate-limit window per request.
  app.set("trust proxy", 1);
  app.use(express.json());

  // Deliberately shallow. Render uses this path both to decide when a deploy
  // goes live and to restart instances it judges unhealthy, so anything this
  // endpoint depends on becomes something that can restart the application. A
  // database check here would turn a Postgres hiccup into a restart loop that
  // outlives the hiccup. Migrations run as a pre-deploy step against the real
  // DATABASE_URL, which is what actually proves the database is reachable.
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  // Everything below this line is closed, so a route added later is protected
  // by default rather than open until somebody remembers to guard it.
  app.use("/api", requireAuth);

  app.use("/api/clients/:clientId/campaigns", clientCampaignRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/campaigns/:campaignId/properties", campaignPropertyRouter);
  app.use("/api/campaigns/:campaignId/records", campaignRecordRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/properties", propertyRouter);
  app.use("/api/records", recordRouter);

  // Anything under /api that reached this far matched no route. Answering here
  // keeps the JSON envelope, and keeps the SPA fallback below from returning
  // HTML for a mistyped endpoint.
  app.use("/api", (_req, _res, next) => {
    next(new NotFoundError("Endpoint not found"));
  });

  // In development the Vite dev server serves the SPA and proxies /api here, so
  // there is no build to serve and this whole layer stays unmounted.
  const webDistPath = options.webDistPath ?? DEFAULT_WEB_DIST;
  if (existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    // Express 5 rejects a bare "*": every wildcard needs a name.
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

export default createApp;
