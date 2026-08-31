import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetAuthRateLimits } from "../../src/auth/auth.routes.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const account = {
  name: "Buyer", email: "profile@acme.com", password: "hunter2hunter2",
  inviteCode: config.inviteCode,
};

beforeEach(async () => { await resetDb(); resetAuthRateLimits(); });
afterAll(async () => { await prisma.$disconnect(); });

async function register() {
  return request(app).post("/api/auth/register").send(account);
}

describe("User API", () => {
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
});
