import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { ProjectStaffing } from "../../projects/index.js";

export class PrismaProjectStaffing implements ProjectStaffing {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  async eligible(orgId: string, memberIds: readonly string[]): Promise<readonly string[]> {
    const members = await this.prisma.membership.findMany({
      where: {
        id: { in: [...memberIds] },
        orgId,
        status: "ACTIVE",
        role: { in: ["MANAGER", "GUEST"] },
      },
      select: { id: true },
    });
    return members.map((member) => member.id);
  }

  async grant(
    context: TransactionContext,
    project: { id: string; clientId: string },
    memberIds: readonly string[],
  ): Promise<void> {
    await this.unitOfWork.clientFor<Prisma.TransactionClient>(context).clientAccess.createMany({
      data: memberIds.map((membershipId) => ({
        membershipId,
        clientId: project.clientId,
        projectId: project.id,
      })),
      skipDuplicates: true,
    });
  }
}
