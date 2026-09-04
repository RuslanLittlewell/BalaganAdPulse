import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { hashPassword, scryptGate, verifyPassword } from "../../src/modules/identity/infrastructure/password-adapter.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("scrypt gate", () => {
  it("never runs more than two hashes at once", async () => {
    const runs = Array.from({ length: 6 }, () => hashPassword("hunter2hunter2"));
    await new Promise((resolve) => setImmediate(resolve));

    expect(scryptGate.stats().active).toBe(2);
    expect(scryptGate.stats().queued).toBe(4);

    await Promise.all(runs);
    expect(scryptGate.stats().active).toBe(0);
    expect(scryptGate.stats().queued).toBe(0);
  });

  it("still verifies correctly through the gate", async () => {
    const stored = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("spends a hash on an unknown email, exactly as on a wrong password", async () => {
    const before = scryptGate.stats().total;
    await request(app).post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "hunter2hunter2" });
    expect(scryptGate.stats().total).toBe(before + 1);
  });

  it("bails out before the gate on a malformed stored hash", async () => {
    const before = scryptGate.stats().total;
    expect(await verifyPassword("hunter2hunter2", "not-a-hash")).toBe(false);
    expect(scryptGate.stats().total).toBe(before);
  });
});
