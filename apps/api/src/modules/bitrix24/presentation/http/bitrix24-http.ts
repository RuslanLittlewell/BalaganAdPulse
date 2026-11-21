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

const webhookLimit = createRateLimit({ windowMs: 60_000, limit: 600, keyOf: (req) => String(req.params.key ?? "unknown") });

export function resetBitrix24WebhookLimit(): void {
  webhookLimit.reset();
}

export function createBitrix24WebhookRouter(bitrix: Bitrix24UseCases): Router {
  const router = Router();
  router.post(
    "/:key",
    webhookLimit,
    express.urlencoded({ extended: true, limit: "64kb" }),
    handle(async (req: Request<{ key: string }>, res) => {
      await bitrix.receive(req.params.key, req.body);
      res.status(202).send();
    }),
  );
  return router;
}
