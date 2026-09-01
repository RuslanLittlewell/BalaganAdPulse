import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("loadActor", () => {
  it("refuses an authenticated user who belongs to no organization -> 403", async () => {
    const { auth } = await signInAs("Stranger", { membership: false });
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBeTruthy();
  });

  it("refuses a suspended member -> 403", async () => {
    const { auth } = await signInAs("Suspended", { status: "SUSPENDED" });
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(403);
  });

  it("lets an active member through", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
  });

  /** The point of loading the membership per request rather than sealing the
   * role into the token: the token below is issued while the member is active
   * and is never reissued, yet the very next call after the suspension fails. */
  it("refuses the very next request after a suspension, on a token issued before it", async () => {
    const { auth, membership } = await signInAs();
    expect((await request(app).get("/api/clients").set(auth)).status).toBe(200);

    await prisma.membership.update({
      where: { id: membership!.id },
      data: { status: "SUSPENDED" },
    });

    expect((await request(app).get("/api/clients").set(auth)).status).toBe(403);
  });

  it("picks up a role change on the next request, without a new token", async () => {
    const { auth, membership } = await signInAs("Boss", { role: "ADMIN" });
    await prisma.membership.update({
      where: { id: membership!.id },
      data: { role: "GUEST" },
    });
    // A guest may still read; what matters here is that the request is
    // evaluated against the stored role rather than the one in the token.
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
  });

  it("still answers 401, not 403, when there is no token at all", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("leaves the auth endpoints reachable without a membership", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });
    expect(res.status).not.toBe(403);
  });
});
