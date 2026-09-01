import { describe, expect, it } from "vitest";
import { Router } from "express";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { REALTIME_PATH } from "../../src/modules/realtime/infrastructure/websocket-transport.js";

describe("realtime wiring", () => {
  // The transport attaches to these two; without them on the container it can
  // only be built by reaching into a module's private path.
  it("exposes the connection registry and the authenticator", () => {
    const container = createContainer();
    expect(container.connections.size()).toBe(0);
    expect(typeof container.authenticate).toBe("function");
  });

  // Two containers would each hold their own registry: the transport would
  // register sockets in one while the task use cases published into the other,
  // and every board would connect successfully and then receive nothing. The
  // sentinel router is how that shows up as a test failure rather than as
  // silence in production.
  it("serves the routes of the container it is given", async () => {
    const sentinel = Router();
    sentinel.get("/", (_req, res) => { res.status(418).json({ sentinel: true }); });
    const app = createApp({
      container: {
        ...createContainer(),
        authentication: (_req, _res, next) => next(),
        actorResolution: (_req, _res, next) => next(),
        requestContext: (_req, _res, next) => next(),
        taskRouter: sentinel,
      },
    });

    const response = await request(app).get("/api/tasks");

    expect(response.status).toBe(418);
  });

  it("serves the socket under /api, so one proxy rule covers it", () => {
    expect(REALTIME_PATH.startsWith("/api/")).toBe(true);
  });
});
