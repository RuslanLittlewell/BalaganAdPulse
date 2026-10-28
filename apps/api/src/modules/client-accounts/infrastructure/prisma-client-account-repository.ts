import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "#shared/domain/index.js";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import { ACCESS_EXISTS } from "../application/client-account-use-cases.js";
import { LoginTakenError, type ClientAccountRepository, type IssuedPassword } from "../application/ports.js";
import type { ClientAccountRecord } from "../domain/client-account.js";

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export class PrismaClientAccountRepository implements ClientAccountRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext) {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async findByClient(clientId: string): Promise<ClientAccountRecord | null> {
    const row = await this.prisma.clientAccount.findUnique({
      where: { clientId },
      select: {
        membershipId: true,
        createdAt: true,
        membership: { select: { userId: true, user: { select: { login: true, issuedPassword: true } } } },
      },
    });
    if (!row?.membership.user.login) return null;
    return {
      userId: row.membership.userId,
      membershipId: row.membershipId,
      login: row.membership.user.login,
      issuedPassword: row.membership.user.issuedPassword,
      createdAt: row.createdAt,
    };
  }

  async createUser(
    context: TransactionContext,
    input: IssuedPassword & { id: string; name: string; login: string },
  ): Promise<void> {
    const users = this.client(context).user;
    if (await users.findUnique({ where: { email: input.login }, select: { id: true } })) throw new LoginTakenError();
    try {
      await users.create({ data: { ...input, email: null } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new LoginTakenError();
      throw error;
    }
  }

  async link(context: TransactionContext, clientId: string, membershipId: string): Promise<Date> {
    try {
      const account = await this.client(context).clientAccount.create({
        data: { clientId, membershipId },
        select: { createdAt: true },
      });
      return account.createdAt;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError("conflict", ACCESS_EXISTS);
      throw error;
    }
  }

  async setPassword(context: TransactionContext, userId: string, password: IssuedPassword): Promise<void> {
    await this.client(context).user.update({ where: { id: userId }, data: password });
  }

  async endSessions(context: TransactionContext, userId: string): Promise<void> {
    await this.client(context).refreshToken.deleteMany({ where: { userId } });
  }
}
