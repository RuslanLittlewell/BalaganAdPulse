import { Router } from "express";
import { NotFoundError } from "../shared/presentation/http-errors.js";
import type { ApiContainer } from "./create-container.js";

export const ROUTE_MOUNTS = [
  { id: "open-auth", path: "/api/auth" },
  { id: "registration-resolver", path: "/api/regustration" },
  { id: "authentication", path: "/api" },
  { id: "actor-resolution", path: "/api" },
  { id: "request-context", path: "/api" },
  { id: "session", path: "/api/auth/me" },
  { id: "user", path: "/api/user" },
  { id: "invites", path: "/api/invites" },
  { id: "members", path: "/api/members" },
  { id: "audit", path: "/api/audit" },
  { id: "project-campaigns", path: "/api/projects/:projectId/campaigns" },
  { id: "projects", path: "/api/projects" },
  { id: "clients", path: "/api/clients" },
  { id: "campaign-properties", path: "/api/campaigns/:campaignId/properties" },
  { id: "campaign-records", path: "/api/campaigns/:campaignId/records" },
  { id: "campaigns", path: "/api/campaigns" },
  { id: "properties", path: "/api/properties" },
  { id: "records", path: "/api/records" },
  { id: "tasks", path: "/api/tasks" },
  { id: "task-images", path: "/api/task-images" },
  { id: "api-not-found", path: "/api" },
] as const;

export function createRoutes(container: ApiContainer): Router {
  const router = Router();
  const handlers = [
    container.authRouter,
    container.registrationResolverRouter,
    container.authentication,
    container.actorResolution,
    container.requestContext,
    container.sessionRouter,
    container.userRouter,
    container.inviteRouter,
    container.memberRouter,
    container.auditRouter,
    container.projectCampaignRouter,
    container.projectRouter,
    container.clientRouter,
    container.campaignPropertyRouter,
    container.campaignRecordRouter,
    container.campaignRouter,
    container.propertyRouter,
    container.recordRouter,
    container.taskRouter,
    container.taskImageRouter,
    (_request: unknown, _response: unknown, next: (error: Error) => void) => next(new NotFoundError("Endpoint not found")),
  ];
  ROUTE_MOUNTS.forEach(({ path }, index) => router.use(path, handlers[index]));
  return router;
}
