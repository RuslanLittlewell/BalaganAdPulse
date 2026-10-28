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

  it("finds an account by its login", async () => {
    const users = new PrismaUserRepository(prisma, new PrismaUnitOfWork<Prisma.TransactionClient>(prisma));
    await prisma.user.create({ data: { name: "Клиника", login: "klinika-4821@balagan.pro", passwordHash: "hash" } });
    expect((await users.findByLogin("klinika-4821@balagan.pro"))?.name).toBe("Клиника");
    expect(await users.findByLogin("klinika-0000@balagan.pro")).toBeNull();
    expect(await users.findByEmail("klinika-4821@balagan.pro")).toBeNull();
  });

  it("drops the issued copy whenever it sets a password itself", async () => {
    const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
    const users = new PrismaUserRepository(prisma, unitOfWork);
    const issued = () => prisma.user.create({
      data: { name: "Клиника", login: `klinika-${Math.random().toString().slice(2, 6)}@balagan.pro`, passwordHash: "hash", issuedPassword: "sealed" },
    });
    const [renamed, changed, reset] = [await issued(), await issued(), await issued()];

    await unitOfWork.run((context) => users.update(context, renamed.id, { name: "Клиника+" }));
    await unitOfWork.run((context) => users.update(context, changed.id, { name: "Клиника", passwordHash: "new" }));
    await unitOfWork.run((context) => users.setPassword(context, reset.id, "new"));

    const kept = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).issuedPassword;
    expect(await kept(renamed.id)).toBe("sealed");
    expect(await kept(changed.id)).toBeNull();
    expect(await kept(reset.id)).toBeNull();
  });

  it("refuses an account with neither an email nor a login", async () => {
    await expect(prisma.user.create({ data: { name: "Nobody", passwordHash: "hash" } })).rejects.toThrow();
  });
});
