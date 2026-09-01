import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createInvite } from "../helpers/auth.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";

const app = createApp();
const body = {
  name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2",
  inviteCode: "invite-first",
};

// Two invitations, because an invitation is single use: the tests that register
// a second time need a second one to reach the behaviour they are about.
beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
  await createInvite("invite-first");
  await createInvite("invite-second");
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Auth API", () => {
  it("POST /api/auth/register creates an account (201)", async () => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("POST /api/auth/register with a wrong code -> 403", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, inviteCode: "nope" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Invalid invite code");
  });

  it("POST /api/auth/register with a short password -> 400", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, password: "short" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/register twice -> 409", async () => {
    await request(app).post("/api/auth/register").send(body);
    // A fresh invitation, so this is the duplicate address being refused rather
    // than the spent code.
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, inviteCode: "invite-second" });
    expect(res.status).toBe(409);
  });

  it("POST /api/auth/login returns a pair (200)", async () => {
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/login")
      .send({ email: body.email, password: body.password });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("POST /api/auth/login with a wrong password -> 401", async () => {
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/login")
      .send({ email: body.email, password: "wrongwrongwrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("POST /api/auth/login does not reveal an unknown email", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ email: "missing@acme.com", password: "wrongwrongwrong" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: "Invalid email or password" } });
  });

  it("POST /api/auth/refresh returns only an access token (200)", async () => {
    const created = await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: created.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("POST /api/auth/refresh with an unknown token -> 401", async () => {
    const res = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: "f".repeat(64) });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/refresh rejects an expired persisted token", async () => {
    const created = await request(app).post("/api/auth/register").send(body);
    await prisma.refreshToken.update({
      where: { tokenHash: new TokenAdapter().hashRefresh(created.body.refreshToken) },
      data: { expiresAt: new Date(0) },
    });
    const res = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: created.body.refreshToken });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: "Session expired" } });
  });

  it("POST /api/auth/logout revokes the token (204)", async () => {
    const created = await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/logout")
      .send({ refreshToken: created.body.refreshToken });
    expect(res.status).toBe(204);

    const after = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: created.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it("POST /api/auth/logout is idempotent for an unknown token", async () => {
    const res = await request(app).post("/api/auth/logout")
      .send({ refreshToken: "already-revoked" });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });
});
