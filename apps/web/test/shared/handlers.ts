import { http, HttpResponse } from "msw";

export const defaultHandlers = [
  http.get("/api/user/profile", () => HttpResponse.json({
    name: "Buyer", email: "buyer@acme.com", image: null, avatarPath: null,
  })),
  http.get("/api/clients", () => HttpResponse.json([])),
  http.get("/api/projects", () => HttpResponse.json([])),
  http.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([])),
];
