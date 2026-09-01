import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getRequestContext, requestContext } from "../../src/shared/presentation/request-context.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { createContainer } from "../../src/composition/create-container.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("requestContext", () => {
  it("carries the actor and request metadata through asynchronous work", async () => {
    const { auth, user, membership } = await signInAs("Context Actor", { role: "MANAGER" });
    const app = express();
    app.set("trust proxy", 1);
    const { authentication, actorResolution } = createContainer();
    app.use(authentication, actorResolution, requestContext);
    app.get("/context", async (_req, res) => {
      await Promise.resolve();
      const context = getRequestContext();
      res.json(context);
    });

    const response = await request(app)
      .get("/context")
      .set(auth)
      .set("x-forwarded-for", "203.0.113.7")
      .set("user-agent", "AdPulse test agent")
      .set("x-request-id", "request-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      actor: {
        userId: user.id,
        membershipId: membership!.id,
        orgId: membership!.orgId,
        role: "MANAGER",
        name: user.name,
        email: user.email,
      },
      ip: "203.0.113.7",
      userAgent: "AdPulse test agent",
      requestId: "request-123",
    });
  });

  it("generates a request id when the caller does not provide one", async () => {
    const { auth } = await signInAs();
    const app = express();
    const { authentication, actorResolution } = createContainer();
    app.use(authentication, actorResolution, requestContext);
    app.get("/context", (_req, res) => res.json(getRequestContext()));

    const response = await request(app).get("/context").set(auth);

    expect(response.status).toBe(200);
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
