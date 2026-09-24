import { http, HttpResponse, ws } from "msw";

export const realtime = ws.link("ws://*/api/realtime");

export const defaultHandlers = [
  http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "ADMIN",
    clientIds: [],
  })),
  http.get("/api/user/profile", () => HttpResponse.json({
    name: "Buyer", email: "buyer@acme.com", image: null, avatarPath: null,
  })),
  http.get("/api/clients", () => HttpResponse.json([])),
  http.get("/api/projects/:projectId/integrations/meta", () => HttpResponse.json(null)),
  http.get("/api/projects", () => HttpResponse.json([])),
  http.get("/api/project-layout", () => HttpResponse.json({ pinned: [], items: [] })),
  http.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([])),
  http.get("/api/invites", () => HttpResponse.json([])),
  http.get("/api/members", () => HttpResponse.json([])),
  http.get("/api/crm/boards/:board/columns", () => HttpResponse.json([
    { id: "NEW", kind: "FIXED", name: "Новый", position: 0 },
    { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1 },
    { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2 },
    { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3 },
  ])),
  realtime.addEventListener("connection", () => undefined),
];
