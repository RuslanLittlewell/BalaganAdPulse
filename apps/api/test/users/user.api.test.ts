import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createInvite } from "../helpers/auth.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const account = {
  name: "Buyer", email: "profile@acme.com", password: "hunter2hunter2",
  inviteCode: "invite-first",
};

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
  await createInvite("invite-first");
});
afterAll(async () => { await prisma.$disconnect(); });

async function register() {
  return request(app).post("/api/auth/register").send(account);
}

describe("User API", () => {
  it("requires authentication for profile reads", async () => {
    const response = await request(app).get("/api/user/profile");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { message: "Authentication required" } });
  });

  it("GET /api/user/profile returns the persisted avatar configuration", async () => {
    const created = await register();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    await prisma.user.update({
      where: { id: user.id },
      data: { image: new Date().toISOString(), avatarPath: '{"topType":"NoHair"}' },
    });
    const response = await request(app).get("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.avatarPath).toBe('{"topType":"NoHair"}');
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("carries the picture itself, so nothing has to fetch it separately", async () => {
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const created = await register();
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    await request(app).put("/api/user/avatar").set(auth)
      .field("avatarPath", JSON.stringify({ topType: "NoHair" }))
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });

    const response = await request(app).get("/api/user/profile").set(auth);

    expect(response.status).toBe(200);
    expect(response.body.image).toMatch(/^data:image\/png;base64,/);
  });

  it("answers 404 for the avatar endpoint that no longer exists", async () => {
    const created = await register();
    const response = await request(app).get("/api/user/avatar")
      .set("Authorization", `Bearer ${created.body.accessToken}`);
    expect(response.status).toBe(404);
  });

  it("reports no picture when the profile has never had one", async () => {
    const created = await register();
    const response = await request(app).get("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`);
    expect(response.body.image).toBeNull();
  });

  it("PATCH /api/user/profile changes the name and returns a fresh token", async () => {
    const created = await register();
    const response = await request(app).patch("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`)
      .send({ name: "New Name" });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    expect((await prisma.user.findUniqueOrThrow({ where: { email: account.email } })).name)
      .toBe("New Name");
  });

  it("changes the password only after checking the current password", async () => {
    const created = await register();
    const denied = await request(app).patch("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`)
      .send({ name: account.name, currentPassword: "incorrect-password", newPassword: "new-password-123" });
    expect(denied.status).toBe(403);

    const changed = await request(app).patch("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`)
      .send({ name: account.name, currentPassword: account.password, newPassword: "new-password-123" });
    expect(changed.status).toBe(200);

    const login = await request(app).post("/api/auth/login")
      .send({ email: account.email, password: "new-password-123" });
    expect(login.status).toBe(200);
  });

  it("requires the current password when a new password is requested", async () => {
    const created = await register();
    const response = await request(app).patch("/api/user/profile")
      .set("Authorization", `Bearer ${created.body.accessToken}`)
      .send({ name: account.name, newPassword: "new-password-123" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation error");
  });

  it("rejects an avatar request without a PNG", async () => {
    const created = await register();
    const response = await request(app).put("/api/user/avatar")
      .set("Authorization", `Bearer ${created.body.accessToken}`)
      .field("avatarPath", JSON.stringify({ topType: "NoHair" }));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: "Avatar PNG is required" } });
  });
});
