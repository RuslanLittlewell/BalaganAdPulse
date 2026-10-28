import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { LoginTakenError } from "../../src/modules/client-accounts/application/ports.js";
import { PrismaClientAccountRepository } from "../../src/modules/client-accounts/infrastructure/prisma-client-account-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const issued = (login: string) => ({
  id: randomUUID(), name: "Клиника", login, passwordHash: "hash", issuedPassword: "sealed",
});

it("counts a login as taken when another account has it as an email", async () => {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  const accounts = new PrismaClientAccountRepository(prisma, unitOfWork);
  await prisma.user.create({ data: { name: "Сотрудник", email: "klinika-4821@balagan.pro", passwordHash: "hash" } });

  await expect(unitOfWork.run((context) => accounts.createUser(context, issued("klinika-4821@balagan.pro"))))
    .rejects.toBeInstanceOf(LoginTakenError);
  await unitOfWork.run((context) => accounts.createUser(context, issued("klinika-1357@balagan.pro")));

  expect(await prisma.user.findUnique({ where: { login: "klinika-1357@balagan.pro" }, select: { email: true } }))
    .toEqual({ email: null });
});
