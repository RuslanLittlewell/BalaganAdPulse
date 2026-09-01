import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { AccessGrant, AccessRepository } from "../application/ports.js";

export class PrismaAccessRepository implements AccessRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  /** Scoped to the organization: a client belonging to another agency simply
   * does not come back, and the use case reports it as unknown. */
  async projectsByClient(
    orgId: string,
    clientIds: readonly string[],
  ): Promise<Map<string, readonly string[]>> {
    const clients = await this.prisma.client.findMany({
      where: { id: { in: [...clientIds] }, orgId },
      select: { id: true, projects: { select: { id: true } } },
    });
    return new Map(
      clients.map((client) => [client.id, client.projects.map((project) => project.id)]),
    );
  }

  /** Delete-then-insert inside the caller's transaction, so the member is never
   * observed holding a half-applied set. */
  async replace(
    context: TransactionContext,
    membershipId: string,
    grants: readonly AccessGrant[],
  ): Promise<void> {
    const client = this.client(context);
    await client.clientAccess.deleteMany({ where: { membershipId } });
    if (grants.length === 0) return;
    await client.clientAccess.createMany({
      data: grants.map((grant) => ({
        membershipId,
        clientId: grant.clientId,
        projectId: grant.projectId,
      })),
    });
  }

  async listFor(membershipId: string) {
    return this.prisma.clientAccess.findMany({
      where: { membershipId },
      select: { membershipId: true, clientId: true, projectId: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
