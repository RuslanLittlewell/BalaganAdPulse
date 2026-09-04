import type { Prisma } from "@prisma/client";
import type { Role } from "@adpulse/access-policy";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";

export class PrismaMembershipEnrolment {
  constructor(private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async enrol(
    context: TransactionContext,
    value: { userId: string; orgId: string; role: Role },
  ): Promise<string> {
    const client = this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
    const membership = await client.membership.create({ data: value, select: { id: true } });
    return membership.id;
  }
}
