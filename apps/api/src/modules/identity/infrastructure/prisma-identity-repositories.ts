import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../shared/domain/index.js";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { RefreshSessionRepository, UserRepository } from "../application/ports.js";

export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }

  async create(context: TransactionContext, input: { name: string; email: string; passwordHash: string }) {
    try {
      return await this.unitOfWork.clientFor<Prisma.TransactionClient>(context).user.create({ data: input });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("conflict", "This email is already registered");
      }
      throw error;
    }
  }

  update(context: TransactionContext, id: string, input: { name: string; passwordHash?: string }) {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context).user.update({ where: { id }, data: input });
  }

  setAvatar(context: TransactionContext, id: string, input: { image: string; avatarPath: string }): Promise<void> {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context).user.update({ where: { id }, data: input }).then(() => undefined);
  }
}

export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  save(context: TransactionContext, value: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context).refreshToken.create({ data: value }).then(() => undefined);
  }

  find(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  }

  revoke(context: TransactionContext, tokenHash: string): Promise<void> {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context).refreshToken.deleteMany({ where: { tokenHash } }).then(() => undefined);
  }
}
