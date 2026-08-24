import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { resetAuthRateLimits } from "../../src/auth/auth.routes.js";
import { hashPassword, scryptGate, verifyPassword } from "../../src/auth/password.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  resetAuthRateLimits();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("scrypt gate", () => {
  it("never runs more than two hashes at once", async () => {
    // Sampled while the hashes are in flight, not after they resolve: by the
    // time a hash's promise settles, `active` has already been decremented and
    // the reading would be meaningless.
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
    // The enumeration defence in auth.service.ts depends on this: if the gate
    // were entered only for known users, queue wait would become the timing
    // channel that DUMMY_PASSWORD_HASH exists to close.
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
