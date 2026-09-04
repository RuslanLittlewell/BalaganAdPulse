import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createInvite, signInAs } from "../helpers/auth.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";

const app = createApp();
const body = {
  name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2",
  inviteCode: "invite-first",
};

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
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith("adpulse_access=") && cookie.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("adpulse_refresh=") && cookie.includes("HttpOnly"))).toBe(true);
  });

  it("POST /api/auth/register with a wrong code -> 403", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, inviteCode: "nope" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Invalid invite code");
  });

  it("POST /api/auth/register with no code at all -> 400", async () => {
    const { inviteCode: _omitted, ...withoutCode } = body;
    const res = await request(app).post("/api/auth/register").send(withoutCode);

    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it("POST /api/auth/register with an empty code -> 400", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, inviteCode: "" });

    expect(res.status).toBe(400);
  });

  it("POST /api/auth/register with a short password -> 400", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, password: "short" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/register twice -> 409", async () => {
    await request(app).post("/api/auth/register").send(body);
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

  it("authenticates, refreshes and logs out through cookies", async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send(body).expect(201);

    await browser.get("/api/auth/me").expect(200);
    await browser.post("/api/auth/refresh").send({}).expect(200);

    const logout = await browser.post("/api/auth/logout").send({});
    expect(logout.status).toBe(204);
    const cookies = logout.headers["set-cookie"] as unknown as string[];
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
    await browser.get("/api/auth/me").expect(401);
  });
});

describe("a person's own contact details", () => {
  it("stores a phone and a telegram given at registration", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, phone: "+375291112233", telegram: "@buyer" });

    expect(res.status).toBe(201);
    const user = await prisma.user.findFirstOrThrow({ where: { email: body.email } });
    expect(user).toMatchObject({ phone: "+375291112233", telegram: "@buyer" });
  });

  it("creates the account without them", async () => {
    const res = await request(app).post("/api/auth/register").send(body);

    expect(res.status).toBe(201);
    const user = await prisma.user.findFirstOrThrow({ where: { email: body.email } });
    expect(user).toMatchObject({ phone: null, telegram: null });
  });

  it("changes them through the profile, and reads them back", async () => {
    const registered = await request(app).post("/api/auth/register").send(body);
    const auth = { Authorization: `Bearer ${registered.body.accessToken}` };

    const updated = await request(app).patch("/api/user/profile").set(auth)
      .send({ name: "Buyer", phone: "+375299998877", telegram: "@newhandle" });
    expect(updated.status).toBe(200);

    const profile = await request(app).get("/api/user/profile").set(auth);
    expect(profile.body).toMatchObject({ phone: "+375299998877", telegram: "@newhandle" });
  });

  it("leaves them alone when the update does not mention them", async () => {
    const registered = await request(app).post("/api/auth/register")
      .send({ ...body, phone: "+375291112233" });
    const auth = { Authorization: `Bearer ${registered.body.accessToken}` };

    await request(app).patch("/api/user/profile").set(auth).send({ name: "Другое имя" });

    const profile = await request(app).get("/api/user/profile").set(auth);
    expect(profile.body.phone).toBe("+375291112233");
  });

  it("is not something an admin can change on somebody else", async () => {
    const registered = await request(app).post("/api/auth/register")
      .send({ ...body, phone: "+375291112233" });
    const user = await prisma.user.findFirstOrThrow({ where: { email: body.email } });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(registered.status).toBe(201);

    const admin = await signInAs("Админ", { role: "ADMIN" });
    const refused = await request(app).patch(`/api/members/${membership.id}`)
      .set(admin.auth).send({ phone: "+375290000000" });

    expect(refused.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone)
      .toBe("+375291112233");
  });
});
