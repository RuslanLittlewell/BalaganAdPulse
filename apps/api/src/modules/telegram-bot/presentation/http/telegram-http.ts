import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "#shared/domain/index.js";
import type { TelegramLinkUseCases } from "#modules/telegram-bot/application/link-use-cases.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle(action: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export const telegramSettingsSchema = z.object({ notifications: z.boolean() }).strict();

export function createTelegramRouter(useCases: TelegramLinkUseCases): Router {
  const router = Router();

  router.get("/", handle(async (req, res) => {
    res.json(await useCases.status(actorOf(req)));
  }));
  router.patch("/", handle(async (req, res) => {
    const { notifications } = telegramSettingsSchema.parse(req.body);
    res.json(await useCases.setNotifications(actorOf(req), notifications));
  }));
  router.post("/link", handle(async (req, res) => {
    res.status(201).json(await useCases.issueLink(actorOf(req)));
  }));
  router.delete("/link", handle(async (req, res) => {
    await useCases.unlink(actorOf(req));
    res.status(204).end();
  }));

  return router;
}
