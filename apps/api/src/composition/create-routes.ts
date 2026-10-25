import { Router } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ApiContainer } from "./create-container.js";

export const ROUTE_MOUNTS = [
  { id: "docs", path: "/api" },
  { id: "open-auth", path: "/api/auth" },
  { id: "google-callback", path: "/api/integrations/google" },
  { id: "registration-resolver", path: "/api/registration" },
  { id: "authentication", path: "/api" },
  { id: "session", path: "/api/auth/me" },
  { id: "platform", path: "/api/platform" },
  { id: "actor-resolution", path: "/api" },
  { id: "request-context", path: "/api" },
  { id: "presence-touch", path: "/api" },
  { id: "reports-module", path: "/api/projects/:projectId/reports" },
  { id: "report-index-module", path: "/api/reports" },
  { id: "crm-module", path: "/api/crm" },
  { id: "tasks-module", path: "/api/tasks" },
  { id: "task-images-module", path: "/api/task-images" },
  { id: "user", path: "/api/user" },
  { id: "invites", path: "/api/invites" },
  { id: "members", path: "/api/members" },
  { id: "audit", path: "/api/audit" },
  { id: "project-metrics", path: "/api/projects/:projectId" },
  { id: "reports", path: "/api/projects/:projectId/reports" },
  { id: "project-documents", path: "/api/projects/:projectId/documents" },
  { id: "report-index", path: "/api/reports" },
  { id: "integrations", path: "/api/projects" },
  { id: "projects", path: "/api/projects" },
  { id: "project-layout", path: "/api/project-layout" },
  { id: "project-groups", path: "/api/project-groups" },
  { id: "clients", path: "/api/clients" },
  { id: "campaigns", path: "/api/campaigns" },
  { id: "ad-sets", path: "/api/ad-sets" },
  { id: "ad-creatives", path: "/api/ad-creatives" },
  { id: "ad-previews", path: "/api/ads" },
  { id: "summary", path: "/api/summary" },
  { id: "tasks", path: "/api/tasks" },
  { id: "leads", path: "/api/crm" },
  { id: "task-images", path: "/api/task-images" },
  { id: "kpi", path: "/api" },
  { id: "summary-tiles", path: "/api" },
  { id: "notifications", path: "/api/notifications" },
  { id: "telegram", path: "/api/telegram" },
  { id: "api-not-found", path: "/api" },
] as const;

export type RouteMountId = (typeof ROUTE_MOUNTS)[number]["id"];

export function mountPath(id: RouteMountId): string {
  const mount = ROUTE_MOUNTS.find((candidate) => candidate.id === id);
  if (!mount) throw new Error(`No route is mounted as ${id}`);
  return mount.path;
}

export function createRoutes(container: ApiContainer): Router {
  const router = Router();
  const handlers = [
    container.documentationRouter,
    container.authRouter,
    container.googleCallbackRouter,
    container.registrationResolverRouter,
    container.authentication,
    container.sessionRouter,
    container.platformRouter,
    container.actorResolution,
    container.requestContext,
    container.presenceTouch,
    container.requireModule("REPORTS"),
    container.requireModule("REPORTS"),
    container.requireModule("CRM"),
    container.requireModule("TASKS"),
    container.requireModule("TASKS"),
    container.userRouter,
    container.inviteRouter,
    container.memberRouter,
    container.auditRouter,
    container.projectMetricRouter,
    container.reportRouter,
    container.projectDocumentRouter,
    container.reportIndexRouter,
    container.integrationRouter,
    container.projectRouter,
    container.projectLayoutRouter,
    container.projectGroupRouter,
    container.clientRouter,
    container.campaignRouter,
    container.adSetRouter,
    container.adCreativeRouter,
    container.adPreviewRouter,
    container.summaryRouter,
    container.taskRouter,
    container.leadRouter,
    container.taskImageRouter,
    container.kpiRouter,
    container.summaryTileRouter,
    container.notificationRouter,
    container.telegramRouter,
    (_request: unknown, _response: unknown, next: (error: Error) => void) =>
      next(new AppError("not-found", "Endpoint not found")),
  ];
  ROUTE_MOUNTS.forEach(({ path }, index) => router.use(path, handlers[index]));
  return router;
}
