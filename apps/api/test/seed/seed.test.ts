import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";
import { seedFirstAdmin } from "../../src/composition/seed-cli.js";
import { verifyPassword } from "../../src/modules/identity/infrastructure/password-adapter.js";

const env = {
  SEED_ADMIN_NAME: "Founder",
  SEED_ADMIN_EMAIL: "founder@acme.com",
  SEED_ADMIN_PASSWORD: "hunter2hunter2",
};

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("seedFirstAdmin", () => {
  it("creates an active admin in the organization the migration made", async () => {
    const result = await seedFirstAdmin(env);
    expect(result.created).toBe(true);

    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: "founder@acme.com" } },
    });
    expect(membership.role).toBe("ADMIN");
    expect(membership.status).toBe("ACTIVE");
    expect(membership.orgId).toBe((await currentOrg()).id);
  });

  it("stores the password hashed, and the hash verifies", async () => {
    await seedFirstAdmin(env);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "founder@acme.com" } });
    expect(user.passwordHash).not.toContain("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", user.passwordHash)).toBe(true);
  });

  it("normalises the address the way registration does", async () => {
    await seedFirstAdmin({ ...env, SEED_ADMIN_EMAIL: "  Founder@ACME.com " });
    expect(await prisma.user.findUnique({ where: { email: "founder@acme.com" } })).not.toBeNull();
  });

  it("does nothing when the organization already has an active admin", async () => {
    await signInAs("Existing", { role: "ADMIN" });
    const result = await seedFirstAdmin(env);

    expect(result.created).toBe(false);
    expect(await prisma.user.findUnique({ where: { email: "founder@acme.com" } })).toBeNull();
  });

  it("still seeds when the only admin is suspended", async () => {
    await signInAs("Dormant", { role: "ADMIN", status: "SUSPENDED" });
    const result = await seedFirstAdmin(env);
    expect(result.created).toBe(true);
  });

  it("promotes an existing account rather than failing on the unique email", async () => {
    const existing = await signInAs("Already Here", { role: "MANAGER" });
    const result = await seedFirstAdmin({ ...env, SEED_ADMIN_EMAIL: existing.user.email });

    expect(result.created).toBe(true);
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: existing.user.id },
    });
    expect(membership.role).toBe("ADMIN");
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses a missing address", async () => {
    await expect(seedFirstAdmin({ ...env, SEED_ADMIN_EMAIL: undefined }))
      .rejects.toThrow(/SEED_ADMIN_EMAIL/);
  });

  it("refuses a missing password", async () => {
    await expect(seedFirstAdmin({ ...env, SEED_ADMIN_PASSWORD: undefined }))
      .rejects.toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("refuses a password too short to be accepted at the login screen", async () => {
    await expect(seedFirstAdmin({ ...env, SEED_ADMIN_PASSWORD: "short" }))
      .rejects.toThrow(/8 characters/);
  });

  it("renames the organization when asked to", async () => {
    await seedFirstAdmin({ ...env, ORG_NAME: "Balagan" });
    expect((await currentOrg()).name).toBe("Balagan");
  });

  it("leaves the organization's name alone when not asked", async () => {
    const before = await currentOrg();
    await seedFirstAdmin(env);
    expect((await currentOrg()).name).toBe(before.name);
  });

  it("lets the seeded admin issue the first invitation", async () => {
    await seedFirstAdmin(env);
    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: "founder@acme.com" } },
    });
    expect(membership.role).toBe("ADMIN");
    expect(membership.status).toBe("ACTIVE");
  });
});
