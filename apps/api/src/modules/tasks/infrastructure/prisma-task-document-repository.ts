import type { Prisma, PrismaClient, TaskDocument as TaskDocumentRow } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type {
  TaskDocumentRecord,
  TaskDocumentRepository,
  TaskDocumentSummary,
} from "../application/ports.js";

function toDomain(row: TaskDocumentRow): TaskDocumentRecord {
  return {
    id: row.id, taskId: row.taskId, uploaderId: row.uploaderId, name: row.name,
    storageKey: row.storageKey, bytes: row.bytes, createdAt: row.createdAt,
  };
}

export class PrismaTaskDocumentRepository implements TaskDocumentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(
    context: TransactionContext,
    input: Omit<TaskDocumentRecord, "createdAt">,
  ): Promise<TaskDocumentRecord> {
    return toDomain(await this.client(context).taskDocument.create({ data: input }));
  }

  async findById(id: string): Promise<TaskDocumentRecord | null> {
    const row = await this.prisma.taskDocument.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async listForTask(taskId: string): Promise<TaskDocumentRecord[]> {
    const rows = await this.prisma.taskDocument.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  }

  countForTask(taskId: string): Promise<number> {
    return this.prisma.taskDocument.count({ where: { taskId } });
  }

  async unclaimedOf(uploaderId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.taskDocument.findMany({
      where: { id: { in: [...ids] }, taskId: null, uploaderId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async claim(
    context: TransactionContext,
    taskId: string,
    uploaderId: string,
    documentIds: readonly string[],
  ): Promise<TaskDocumentSummary[]> {
    const client = this.client(context);
    if (documentIds.length > 0) {
      await client.taskDocument.updateMany({
        where: { id: { in: [...documentIds] }, taskId: null, uploaderId },
        data: { taskId },
      });
    }
    const attached = await client.taskDocument.findMany({
      where: { taskId }, select: { id: true, name: true, bytes: true }, orderBy: { createdAt: "asc" },
    });
    return attached;
  }

  async deleteMany(context: TransactionContext, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.client(context).taskDocument.deleteMany({ where: { id: { in: [...ids] } } });
  }
}
