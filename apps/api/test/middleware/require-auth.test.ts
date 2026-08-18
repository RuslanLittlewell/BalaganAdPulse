import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";
import { config } from "../../src/config.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

/** A structurally valid, correctly signed token whose lifetime has already
 * passed — the one rejection path the plan's own test list forgot. */
async function expiredTokenFor(user: { id: string; name: string; email: string }): Promise<string> {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(nowInSeconds - 3600)
    .setExpirationTime(nowInSeconds - 1800)
    .sign(new TextEncoder().encode(config.jwtSecret));
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header -> 401", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentication required");
  });

  it("rejects a header that is not a Bearer token -> 401", async () => {
    const res = await request(app).get("/api/clients").set({ Authorization: "Basic abc" });
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token -> 401", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/clients")
      .set({ Authorization: `${auth.Authorization}x` });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token -> 401", async () => {
    const { user } = await signInAs();
    const token = await expiredTokenFor(user);
    const res = await request(app).get("/api/clients").set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentication required");
  });

  it("admits a valid token -> 200", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
  });

  it("leaves the auth routes open", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x", password: "y" });
    expect(res.status).not.toBe(401);
  });
});
