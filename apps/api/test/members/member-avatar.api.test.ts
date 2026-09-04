import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };
let membershipId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  membershipId = admin.actor!.membershipId;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("GET /api/members/:id/avatar", () => {
  it("404s for a member who has no picture", async () => {
    const res = await request(app).get(`/api/members/${membershipId}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for a membership in another organization", async () => {
    const other = await signInAs("Other", { role: "ADMIN" });
    const res = await request(app)
      .get(`/api/members/${other.actor!.membershipId}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for a membership that does not exist", async () => {
    const res = await request(app).get(`/api/members/${MISSING}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`/api/members/${membershipId}/avatar`);
    expect(res.status).toBe(401);
  });

  it("serves the stored picture as an image", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const upload = await request(app).put("/api/user/avatar").set(auth)
      .field("avatarPath", JSON.stringify({ topType: "NoHair" }))
      .attach("image", png, { filename: "a.png", contentType: "image/png" });
    expect(upload.status).toBe(204);

    const res = await request(app).get(`/api/members/${membershipId}/avatar`).set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body.length).toBeGreaterThan(0);
  });
});
