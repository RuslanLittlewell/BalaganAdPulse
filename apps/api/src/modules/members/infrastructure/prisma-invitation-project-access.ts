import type { Prisma } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { InvitationProjectAccess } from "../../invites/index.js";

export class PrismaInvitationProjectAccess implements InvitationProjectAccess {
  constructor(private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async grant(
    context: TransactionContext,
    membershipId: string,
    projectIds: readonly string[],
  ): Promise<void> {
    const client = this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
    const projects = await client.project.findMany({
      where: { id: { in: [...projectIds] } },
      select: { id: true, clientId: true },
    });
    if (projects.length !== new Set(projectIds).size) {
      throw new Error("Invitation project no longer exists");
    }
    await client.clientAccess.createMany({
      data: projects.map((project) => ({
        membershipId,
        clientId: project.clientId,
        projectId: project.id,
      })),
    });
  }
}
