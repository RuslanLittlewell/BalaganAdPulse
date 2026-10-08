import type { Prisma, PrismaClient, Project as ProjectRow } from "@prisma/client";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { NewProject, ProjectChange, ProjectRecord } from "../domain/project.js";
import type { ProjectRepository } from "../application/ports.js";
import { reachableProjects } from "#shared/infrastructure/project-reach.js";

function toDomain(row: ProjectRow): ProjectRecord {
  return {
    id: row.id, clientId: row.clientId, name: row.name,
    budgetCurrency: row.budgetCurrency,
    priority: row.priority, image: row.image, avatarPath: row.avatarPath,
    position: row.position, createdAt: row.createdAt, updatedAt: row.updatedAt,
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
    input: Omit<NewProject, "memberIds"> & { id: string; position: number },
  ): Promise<ProjectRecord> {
    return toDomain(await this.client(context).project.create({ data: input }));
  }

  countForClient(clientId: string): Promise<number> {
    return this.prisma.project.count({ where: { clientId } });
  }

  async listReachable(actor: ActorContext, clientId?: string): Promise<ProjectRecord[]> {
    const rows = await this.prisma.project.findMany({
      where: { ...reachableProjects(actor), ...(clientId ? { clientId } : {}) },
      orderBy: [{ clientId: "asc" }, { position: "asc" }],
    });
    return rows.map(toDomain);
  }

  async findReachable(actor: ActorContext, id: string): Promise<ProjectRecord | null> {
    const row = await this.prisma.project.findFirst({ where: { id, ...reachableProjects(actor) } });
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
