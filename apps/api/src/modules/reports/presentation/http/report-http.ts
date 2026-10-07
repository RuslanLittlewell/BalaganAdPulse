import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ReportUseCases } from "../../application/report-use-cases.js";
import { coverUpload } from "./cover-upload.js";
import { editSchema, generateSchema, listQuerySchema } from "./report-schemas.js";

type ProjectRequest = Request<{ projectId: string }>;
type ReportRequest = Request<{ projectId: string; reportId: string }>;

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(action: (req: TRequest, res: Response) => Promise<void>) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createReportRouter(reports: ReportUseCases): Router {
  const router = Router({ mergeParams: true });
  router.get("/", handle(async (req: ProjectRequest, res) => {
    res.json(await reports.list(actorOf(req), req.params.projectId));
  }));
  router.post("/", handle(async (req: ProjectRequest, res) => {
    const actor = actorOf(req);
    const { month } = generateSchema.parse(req.body);
    res.status(201).json(await reports.generate(actor, req.params.projectId, month));
  }));
  router.get("/:reportId", handle(async (req: ReportRequest, res) => {
    res.json(await reports.read(actorOf(req), req.params.projectId, req.params.reportId));
  }));
  router.patch("/:reportId", handle(async (req: ReportRequest, res) => {
    const actor = actorOf(req);
    res.json(await reports.edit(actor, req.params.projectId, req.params.reportId, editSchema.parse(req.body)));
  }));
  router.delete("/:reportId", handle(async (req: ReportRequest, res) => {
    await reports.remove(actorOf(req), req.params.projectId, req.params.reportId);
    res.status(204).end();
  }));
  router.put("/:reportId/cover", coverUpload, handle(async (req: ReportRequest, res) => {
    const actor = actorOf(req);
    if (!req.file) throw new AppError("validation", "A cover image is required");
    res.json(await reports.setCover(actor, req.params.projectId, req.params.reportId, req.file.buffer));
  }));
  router.get("/:reportId/cover", handle(async (req: ReportRequest, res) => {
    const cover = await reports.readCover(actorOf(req), req.params.projectId, req.params.reportId);
    res.setHeader("Content-Type", cover.contentType);
    res.setHeader("Cache-Control", "private, no-cache");
    res.send(Buffer.from(cover.body));
  }));
  router.delete("/:reportId/cover", handle(async (req: ReportRequest, res) => {
    res.json(await reports.removeCover(actorOf(req), req.params.projectId, req.params.reportId));
  }));
  router.post("/:reportId/refresh", handle(async (req: ReportRequest, res) => {
    res.json(await reports.refresh(actorOf(req), req.params.projectId, req.params.reportId));
  }));
  router.post("/:reportId/publish", handle(async (req: ReportRequest, res) => {
    res.json(await reports.publish(actorOf(req), req.params.projectId, req.params.reportId));
  }));
  router.post("/:reportId/unpublish", handle(async (req: ReportRequest, res) => {
    res.json(await reports.unpublish(actorOf(req), req.params.projectId, req.params.reportId));
  }));
  return router;
}

export function createReportIndexRouter(reports: ReportUseCases): Router {
  const router = Router();
  router.get("/", handle(async (req, res) => {
    const actor = actorOf(req);
    res.json(await reports.listAll(actor, listQuerySchema.parse(req.query).projectId));
  }));
  router.get("/:reportId", handle(async (req: Request<{ reportId: string }>, res) => {
    res.json(await reports.readById(actorOf(req), req.params.reportId));
  }));
  return router;
}
