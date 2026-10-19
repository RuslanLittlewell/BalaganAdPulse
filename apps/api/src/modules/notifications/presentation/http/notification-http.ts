import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { NotificationUseCases } from "#modules/notifications/application/notification-use-cases.js";
import type { NotificationView } from "#modules/notifications/domain/notification.js";

export const STREAM_RETRY_MS = 5_000;
export const STREAM_KEEPALIVE_MS = 25_000;

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

const eventOf = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

export function createNotificationRouter(
  useCases: NotificationUseCases,
  options: { keepaliveMs?: number } = {},
): Router {
  const keepaliveMs = options.keepaliveMs ?? STREAM_KEEPALIVE_MS;
  const router = Router();

  router.get("/", handle(async (req, res) => {
    res.json(await useCases.list(actorOf(req)));
  }));

  router.post("/read-all", handle(async (req, res) => {
    await useCases.readAll(actorOf(req));
    res.status(204).end();
  }));

  router.post("/:id/read", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.read(actorOf(req), req.params.id);
    res.status(204).end();
  }));

  router.get("/stream", (req, res) => {
    const actor = actorOf(req);
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`retry: ${STREAM_RETRY_MS}\n\n`);
    res.write(eventOf("ready", {}));
    const unsubscribe = useCases.subscribe(actor, {
      deliver: (notification: NotificationView) => { res.write(eventOf("notification", notification)); },
      end: () => { res.end(); },
    });
    const keepalive = setInterval(() => { res.write(": keepalive\n\n"); }, keepaliveMs);
    res.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  return router;
}
