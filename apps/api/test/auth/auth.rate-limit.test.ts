import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";

const app = createApp();
const credentials = { email: "buyer@acme.com", password: "hunter2hunter2" };

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Auth rate limiting", () => {
  it("answers 429 after ten login attempts from one address", async () => {
    // Pinned via X-Forwarded-For rather than left to connect unqualified: an
    // unqualified request keys off a `localhost` lookup, which resolves
    // through the same libuv threadpool scrypt hashing uses and can come back
    // as either address family under load, splitting the ten attempts across
    // two rate-limit buckets instead of filling one.
    const address = "203.0.113.1";
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", address).send(credentials);
      expect(res.status).toBe(401);
    }
    const res = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", address).send(credentials);
    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe("Too many requests, try again later");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("counts a forwarded address rather than the proxy's", async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", "203.0.113.9").send(credentials);
    }
    const blocked = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.9").send(credentials);
    expect(blocked.status).toBe(429);

    const other = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.10").send(credentials);
    expect(other.status).toBe(401);
  });

  it("ignores a forged chain longer than one hop", async () => {
    // trust proxy = 1 takes only the last entry, so prepending addresses
    // cannot mint a fresh window per request.
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.${i}, 203.0.113.20`).send(credentials);
    }
    const res = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.99, 203.0.113.20").send(credentials);
    expect(res.status).toBe(429);
  });

  it("gives refresh a higher ceiling than login", async () => {
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "nope" });
      expect(res.status).toBe(401);
    }
  });
});
