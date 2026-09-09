import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { ActorContext } from "#shared/application/index.js";
import type { GroupRecord, StoredLayout } from "../domain/layout.js";
import type { ProjectLayoutRepository, ProjectReach } from "../application/ports.js";

export class PrismaProjectLayoutRepository implements ProjectLayoutRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async read(membershipId: string): Promise<StoredLayout> {
    const [groups, placements] = await Promise.all([
      this.prisma.projectGroup.findMany({ where: { membershipId }, orderBy: { position: "asc" } }),
      this.prisma.projectPlacement.findMany({
        where: { membershipId },
        orderBy: [{ pinned: "desc" }, { position: "asc" }, { projectId: "asc" }],
      }),
    ]);
    return {
      groups: groups.map(({ id, name, position }) => ({ id, name, position })),
      placements: placements.map(({ projectId, groupId, position, pinned }) => ({
        projectId, groupId, position, pinned,
      })),
    };
  }

  async replace(
    context: TransactionContext,
    membershipId: string,
    layout: StoredLayout,
  ): Promise<void> {
    const client = this.client(context);
    await client.projectPlacement.deleteMany({ where: { membershipId } });
    await client.projectPlacement.createMany({
      data: layout.placements.map((placement) => ({ membershipId, ...placement })),
    });
    for (const { id, name, position } of layout.groups) {
      await client.projectGroup.updateMany({ where: { id, membershipId }, data: { name, position } });
    }
  }

  async createGroup(
    context: TransactionContext,
    input: { id: string; membershipId: string; name: string; position: number },
  ): Promise<GroupRecord> {
    const { id, name, position } = await this.client(context).projectGroup.create({ data: input });
    return { id, name, position };
  }

  async deleteGroup(
    context: TransactionContext,
    membershipId: string,
    groupId: string,
  ): Promise<void> {
    await this.client(context).projectGroup.deleteMany({ where: { id: groupId, membershipId } });
  }
}

export class PrismaLayoutProjectReach implements ProjectReach {
  constructor(private readonly prisma: PrismaClient) {}

  async reachableIds(actor: ActorContext): Promise<readonly string[]> {
    const where: Prisma.ProjectWhereInput = actor.role === "ADMIN"
      ? { client: { orgId: actor.orgId } }
      : {
          client: { orgId: actor.orgId },
          OR: [
            { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
            { access: { some: { membershipId: actor.membershipId } } },
          ],
        };
    const rows = await this.prisma.project.findMany({
      where,
      orderBy: [{ clientId: "asc" }, { position: "asc" }],
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
