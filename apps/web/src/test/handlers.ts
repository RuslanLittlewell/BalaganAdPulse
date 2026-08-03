import { http, HttpResponse } from "msw";

export const defaultHandlers = [
  http.get("/api/clients", () => HttpResponse.json([])),
];
