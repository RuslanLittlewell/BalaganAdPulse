import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { PendingTrialSignup, TrialSignupRepository } from "../application/ports.js";

export class PrismaTrialSignupRepository implements TrialSignupRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  replace(context: TransactionContext, signup: PendingTrialSignup): Promise<void> {
    const { email, id: _id, ...link } = signup;
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context).trialSignup
      .upsert({ where: { email }, create: signup, update: { ...link, createdAt: new Date() } })
      .then(() => undefined);
  }

  find(tokenHash: string): Promise<PendingTrialSignup | null> {
    return this.prisma.trialSignup.findUnique({ where: { tokenHash } });
  }

  async consume(context: TransactionContext, tokenHash: string): Promise<boolean> {
    const { count } = await this.unitOfWork.clientFor<Prisma.TransactionClient>(context).trialSignup
      .deleteMany({ where: { tokenHash } });
    return count > 0;
  }
}
