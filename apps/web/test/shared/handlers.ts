import { http, HttpResponse, ws } from "msw";

/**
 * The board's live feed.
 *
 * Every test that renders the board opens this, so without a handler MSW logs
 * an intercepted-connection error for each one. Declared here and left silent:
 * a test that cares about events drives the socket directly through an
 * injected factory rather than through MSW.
 */
const realtime = ws.link("ws://*/api/realtime");

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
  http.get("/api/projects", () => HttpResponse.json([])),
  http.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([])),
  http.get("/api/invites", () => HttpResponse.json([])),
  realtime.addEventListener("connection", () => undefined),
];
