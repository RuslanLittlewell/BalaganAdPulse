import type { Prisma, PrismaClient, Project as ProjectRow } from "@prisma/client";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { NewProject, ProjectChange, ProjectRecord } from "../domain/project.js";
import type { ProjectRepository } from "../application/ports.js";

/** Money crosses the boundary as a decimal string, never a float. `toString`
 * rather than a fixed scale: that is what the column has always serialised to,
 * and the characterization tests hold the API to `"1500"`, not `"1500.00"`. */
function toDomain(row: ProjectRow): ProjectRecord {
  return {
    id: row.id, clientId: row.clientId, name: row.name, niche: row.niche,
    monthlyBudget: row.monthlyBudget === null ? null : row.monthlyBudget.toString(),
    priority: row.priority, image: row.image, avatarPath: row.avatarPath,
    position: row.position, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/**
 * Which projects an actor can reach.
 *
 * Not simply "a reachable client": a grant may name one project, and then the
 * client's other projects stay out of reach. The two branches are the two kinds
 * of grant — one over the whole client, one over this project.
 */
function reachFilter(actor: ActorContext): Prisma.ProjectWhereInput {
  if (actor.role === "ADMIN") return { client: { orgId: actor.orgId } };
  return {
    client: { orgId: actor.orgId },
    OR: [
      { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
      { access: { some: { membershipId: actor.membershipId } } },
    ],
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(
    context: TransactionContext,
    input: NewProject & { id: string; position: number },
  ): Promise<ProjectRecord> {
    return toDomain(await this.client(context).project.create({ data: input }));
  }

  countForClient(clientId: string): Promise<number> {
    return this.prisma.project.count({ where: { clientId } });
  }

  async listReachable(actor: ActorContext, clientId?: string): Promise<ProjectRecord[]> {
    const rows = await this.prisma.project.findMany({
      where: { ...reachFilter(actor), ...(clientId ? { clientId } : {}) },
      orderBy: [{ clientId: "asc" }, { position: "asc" }],
    });
    return rows.map(toDomain);
  }

  async findReachable(actor: ActorContext, id: string): Promise<ProjectRecord | null> {
    const row = await this.prisma.project.findFirst({ where: { id, ...reachFilter(actor) } });
    return row && toDomain(row);
  }

  async update(
    context: TransactionContext,
    id: string,
    input: ProjectChange,
  ): Promise<ProjectRecord> {
    return toDomain(await this.client(context).project.update({ where: { id }, data: input }));
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).project.delete({ where: { id } });
  }
}
