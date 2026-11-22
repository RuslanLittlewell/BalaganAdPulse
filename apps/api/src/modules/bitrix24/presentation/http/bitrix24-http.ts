import express, { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import { createRateLimit } from "#shared/presentation/rate-limit.js";
import type { Bitrix24UseCases } from "#modules/bitrix24/application/bitrix24-use-cases.js";
import type { RunRecord } from "#modules/bitrix24/application/ports.js";
import { changeConnectionSchema, connectSchema, runSchema, stageMappingSchema } from "./bitrix24-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(action: (req: TRequest, res: Response) => Promise<void>) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

const runView = ({ cursor: _cursor, ...run }: RunRecord) => run;

export function createBitrix24Router(bitrix: Bitrix24UseCases): Router {
  const router = Router();
  router.get("/connection", handle(async (req, res) => {
    res.json(await bitrix.read(actorOf(req)));
  }));
  router.post("/connection", handle(async (req, res) => {
    res.status(201).json(await bitrix.connect(actorOf(req), connectSchema.parse(req.body)));
  }));
  router.patch("/connection", handle(async (req, res) => {
    res.json(await bitrix.change(actorOf(req), changeConnectionSchema.parse(req.body)));
  }));
  router.delete("/connection", handle(async (req, res) => {
    await bitrix.remove(actorOf(req));
    res.status(204).send();
  }));
  router.get("/statuses", handle(async (req, res) => {
    res.json(await bitrix.statuses(actorOf(req)));
  }));
  router.get("/stages", handle(async (req, res) => {
    res.json(await bitrix.stages(actorOf(req)));
  }));
  router.put("/stages", handle(async (req, res) => {
    await bitrix.setStages(actorOf(req), stageMappingSchema.parse(req.body).links);
    res.json(await bitrix.stages(actorOf(req)));
  }));
  router.get("/problems", handle(async (req, res) => {
    res.json(await bitrix.problems(actorOf(req)));
  }));
  router.post("/runs", handle(async (req, res) => {
    res.status(202).json(runView(await bitrix.startRun(actorOf(req), runSchema.parse(req.body).direction)));
  }));
  router.get("/runs/latest", handle(async (req, res) => {
    const run = await bitrix.latestRun(actorOf(req));
    res.json(run && runView(run));
  }));
  return router;
}

const MINUTE = 60_000;
const REFUSALS_PER_MINUTE = 30;
const MAX_TRACKED_ADDRESSES = 10_000;

const webhookLimit = createRateLimit({ windowMs: MINUTE, limit: 600, keyOf: (req) => String(req.params.key ?? "unknown") });

function createRefusalLimit(limit: number, windowMs: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    blocked(key: string): number | null {
      const window = windows.get(key);
      const now = Date.now();
      return window && window.resetAt > now && window.count >= limit ? Math.ceil((window.resetAt - now) / 1000) : null;
    },
    record(key: string): void {
      const now = Date.now();
      const window = windows.get(key);
      if (window && window.resetAt > now) {
        window.count += 1;
        return;
      }
      if (windows.size >= MAX_TRACKED_ADDRESSES) {
        for (const [tracked, entry] of windows) if (entry.resetAt <= now) windows.delete(tracked);
        if (windows.size >= MAX_TRACKED_ADDRESSES) windows.delete(windows.keys().next().value!);
      }
      windows.set(key, { count: 1, resetAt: now + windowMs });
    },
    reset(): void {
      windows.clear();
    },
  };
}

const refusals = createRefusalLimit(REFUSALS_PER_MINUTE, MINUTE);

export function resetBitrix24WebhookLimit(): void {
  webhookLimit.reset();
  refusals.reset();
}

export function createBitrix24WebhookRouter(bitrix: Bitrix24UseCases): Router {
  const router = Router();
  router.post(
    "/:key",
    webhookLimit,
    express.urlencoded({ extended: true, limit: "64kb" }),
    handle(async (req: Request<{ key: string }>, res) => {
      const address = req.ip ?? "unknown";
      const retryAfter = refusals.blocked(address);
      if (retryAfter !== null) {
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({ error: { message: "Too many requests, try again later" } });
        return;
      }
      try {
        await bitrix.receive(req.params.key, req.body);
      } catch (error) {
        if (error instanceof AppError && error.category === "not-found") refusals.record(address);
        throw error;
      }
      res.status(202).send();
    }),
  );
  return router;
}
