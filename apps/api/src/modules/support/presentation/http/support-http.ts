import multer from "multer";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import { createRateLimit, type RateLimiter } from "#shared/presentation/rate-limit.js";
import type { SupportUseCases } from "#modules/support/application/support-use-cases.js";
import { MAX_SCREENSHOT_BYTES, MAX_SCREENSHOTS } from "#modules/support/domain/feedback.js";
import { feedbackSchema } from "./support-schemas.js";

export const FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
export const FEEDBACK_PER_WINDOW = 5;

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCREENSHOT_BYTES, files: MAX_SCREENSHOTS, fields: 10 },
}).array("screenshots", MAX_SCREENSHOTS);

const screenshotUpload: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError("validation", error.code === "LIMIT_FILE_SIZE"
        ? "A screenshot is too large; the limit is 5 MB"
        : `At most ${MAX_SCREENSHOTS} screenshots can be attached`));
      return;
    }
    next(error);
  });
};

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle(action: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(() => action(req, res)).catch(next);
  };
}

export interface SupportRouter extends Router {
  readonly feedbackLimit: RateLimiter;
}

export function createSupportRouter(useCases: SupportUseCases): SupportRouter {
  const router = Router();
  const feedbackLimit = createRateLimit({
    windowMs: FEEDBACK_WINDOW_MS,
    limit: FEEDBACK_PER_WINDOW,
    keyOf: (req) => req.actor?.userId ?? req.ip ?? "unknown",
  });
  router.get("/contacts", handle((req, res) => {
    actorOf(req);
    res.json(useCases.contacts());
  }));
  router.post("/feedback", feedbackLimit, screenshotUpload, handle(async (req, res) => {
    const actor = actorOf(req);
    const { topic, message, page, userAgent, screen } = feedbackSchema.parse(req.body);
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((file) => file.buffer);
    await useCases.sendFeedback(actor, { topic, message, context: { page, userAgent, screen }, files });
    res.status(202).send();
  }));
  return Object.assign(router, { feedbackLimit });
}
