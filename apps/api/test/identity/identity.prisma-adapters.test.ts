import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaRefreshSessionRepository, PrismaUserRepository } from "../../src/modules/identity/infrastructure/prisma-identity-repositories.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("identity Prisma adapters", () => {
  it("persists users and refresh sessions in one opaque transaction", async () => {
    const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
    const users = new PrismaUserRepository(prisma, unitOfWork);
    const sessions = new PrismaRefreshSessionRepository(prisma, unitOfWork);
    await unitOfWork.run(async (context) => {
      const user = await users.create(context, { name: "Buyer", email: "buyer@acme.com", passwordHash: "hash" });
      await sessions.save(context, { userId: user.id, tokenHash: "digest", expiresAt: new Date("2026-09-30T00:00:00.000Z") });
    });
    expect((await users.findByEmail("buyer@acme.com"))?.name).toBe("Buyer");
    expect((await sessions.find("digest"))?.user.email).toBe("buyer@acme.com");
  });

  it("revokes a refresh token idempotently", async () => {
    const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
    const users = new PrismaUserRepository(prisma, unitOfWork);
    const sessions = new PrismaRefreshSessionRepository(prisma, unitOfWork);
    await unitOfWork.run(async (context) => {
      const user = await users.create(context, { name: "Buyer", email: "buyer@acme.com", passwordHash: "hash" });
      await sessions.save(context, { userId: user.id, tokenHash: "digest", expiresAt: new Date("2026-09-30T00:00:00.000Z") });
    });
    await unitOfWork.run((context) => sessions.revoke(context, "digest"));
    await unitOfWork.run((context) => sessions.revoke(context, "digest"));
    expect(await sessions.find("digest")).toBeNull();
  });
});
