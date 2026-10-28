import { http, HttpResponse, ws } from "msw";
import { EMPTY_PERFORMANCE } from "@/entities/campaign/index.js";

export const realtime = ws.link("ws://*/api/realtime");

export const defaultHandlers = [
  http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", login: null, image: null },
    platformAdmin: false,
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse", status: "ACTIVE" },
    role: "ADMIN",
    membershipId: "member-1",
    clientIds: [],
    modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
  })),
  http.get("/api/user/profile", () => HttpResponse.json({
    name: "Buyer", email: "buyer@acme.com", login: null, image: null, avatarPath: null,
  })),
  http.get("/api/clients", () => HttpResponse.json([])),
  http.get("/api/clients/:clientId/account", () => HttpResponse.json(null)),
  http.get("/api/projects/:projectId/integrations", () => HttpResponse.json([])),
  http.get("/api/projects", () => HttpResponse.json([])),
  http.get("/api/project-layout", () => HttpResponse.json({ pinned: [], items: [] })),
  http.get("/api/summary", () => HttpResponse.json([])),
  http.get("/api/summary/projects", () => HttpResponse.json([])),
  http.get("/api/summary/channels", () => HttpResponse.json([])),
  http.get("/api/dashboard/summary-tiles", () => HttpResponse.json({ tiles: ["CONVERSIONS"] })),
  http.get("/api/notifications", () => HttpResponse.json({ notifications: [], unreadCount: 0 })),
  http.get("/api/audit/actors", () => HttpResponse.json([])),
  http.get("/api/tasks", () => HttpResponse.json([])),
  http.get("/api/tasks/:taskId/comments", () => HttpResponse.json([])),
  http.get("/api/telegram", () => HttpResponse.json({ available: false, linked: false, username: null, linkedAt: null, notifications: false })),
  http.get("/api/projects/:projectId/summary-tiles", () => HttpResponse.json({ tiles: [] })),
  http.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([])),
  http.get("/api/projects/:projectId/summary", () => HttpResponse.json(EMPTY_PERFORMANCE)),
  http.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(null)),
  http.get("/api/projects/:projectId/kpis", () => HttpResponse.json([])),
  http.get("/api/members/:memberId/access", () => HttpResponse.json([])),
  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/crm/boards/:board/leads/:leadId/activity", () => HttpResponse.json([])),
  http.get("/api/projects/:projectId/reports", () => HttpResponse.json({ reports: [], available: [] })),
  http.get("/api/reports", () => HttpResponse.json([])),
  http.get("/api/invites", () => HttpResponse.json([])),
  http.get("/api/members", () => HttpResponse.json([])),
  http.get("/api/crm/project-stage-counts", () => HttpResponse.json([])),
  http.get("/api/crm/boards/:board/columns", () => HttpResponse.json([
    { id: "NEW", kind: "FIXED", name: "Новый", position: 0 },
    { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1 },
    { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2 },
    { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3 },
  ])),
  realtime.addEventListener("connection", () => undefined),
];
