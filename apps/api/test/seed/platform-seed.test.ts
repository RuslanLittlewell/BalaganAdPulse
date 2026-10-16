import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { seedPlatformAdmin } from "../../src/composition/seed-cli.js";
import { verifyPassword } from "../../src/modules/identity/infrastructure/password-adapter.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const env = {
  SEED_PLATFORM_ADMIN_EMAIL: "global-admin@example.com",
  SEED_PLATFORM_ADMIN_PASSWORD: "hunter2hunter2",
};

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("seedPlatformAdmin", () => {
  it("creates the platform administrator with a hashed password and no membership", async () => {
    const result = await seedPlatformAdmin(env);

    expect(result.created).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "global-admin@example.com" },
      include: { memberships: true },
    });
    expect(user.isPlatformAdmin).toBe(true);
    expect(user.memberships).toEqual([]);
    expect(user.passwordHash).not.toContain("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", user.passwordHash)).toBe(true);
  });

  it("normalises the address the way registration does", async () => {
    await seedPlatformAdmin({ ...env, SEED_PLATFORM_ADMIN_EMAIL: "  Global-Admin@EXAMPLE.com " });
    expect(await prisma.user.findUnique({ where: { email: "global-admin@example.com" } })).not.toBeNull();
  });

  it("does nothing when run again, and leaves the password alone", async () => {
    await seedPlatformAdmin(env);
    const result = await seedPlatformAdmin({ ...env, SEED_PLATFORM_ADMIN_PASSWORD: "another-password" });

    expect(result.created).toBe(false);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "global-admin@example.com" } });
    expect(await verifyPassword("hunter2hunter2", user.passwordHash)).toBe(true);
    expect(await prisma.user.count({ where: { isPlatformAdmin: true } })).toBe(1);
  });

  it("keeps a single platform administrator even when another address is given", async () => {
    await seedPlatformAdmin(env);
    await seedPlatformAdmin({ ...env, SEED_PLATFORM_ADMIN_EMAIL: "someone-else@example.com" });

    expect(await prisma.user.count({ where: { isPlatformAdmin: true } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { email: "someone-else@example.com" } })).toBeNull();
  });

  it("refuses a missing address", async () => {
    await expect(seedPlatformAdmin({ SEED_PLATFORM_ADMIN_PASSWORD: "hunter2hunter2" }))
      .rejects.toThrow("SEED_PLATFORM_ADMIN_EMAIL");
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses a missing password", async () => {
    await expect(seedPlatformAdmin({ SEED_PLATFORM_ADMIN_EMAIL: "global-admin@example.com" }))
      .rejects.toThrow("SEED_PLATFORM_ADMIN_PASSWORD");
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses a password shorter than eight characters", async () => {
    await expect(seedPlatformAdmin({ ...env, SEED_PLATFORM_ADMIN_PASSWORD: "short" }))
      .rejects.toThrow("at least 8 characters");
    expect(await prisma.user.count()).toBe(0);
  });

  it("makes an existing account without a membership the administrator, keeping its password", async () => {
    await prisma.user.create({
      data: { name: "Owner", email: "global-admin@example.com", passwordHash: "kept" },
    });

    expect((await seedPlatformAdmin(env)).created).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "global-admin@example.com" } });
    expect(user.isPlatformAdmin).toBe(true);
    expect(user.passwordHash).toBe("kept");
  });

  it("refuses an address that belongs to an organization", async () => {
    const member = await signInAs("Member");

    await expect(seedPlatformAdmin({ ...env, SEED_PLATFORM_ADMIN_EMAIL: member.user.email }))
      .rejects.toThrow("belongs to an organization");
    expect(await prisma.user.count({ where: { isPlatformAdmin: true } })).toBe(0);
  });
});
