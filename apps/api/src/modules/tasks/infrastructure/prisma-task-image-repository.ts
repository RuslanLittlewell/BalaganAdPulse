import type { Prisma, PrismaClient, TaskImage as TaskImageRow } from "@prisma/client";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import { getObject, putObject, removeObjects } from "../../../shared/infrastructure/storage.js";
import type {
  TaskImageRecord,
  TaskImageRepository,
  TaskImageStorage,
} from "../application/ports.js";

function toDomain(row: TaskImageRow): TaskImageRecord {
  return {
    id: row.id, taskId: row.taskId, uploaderId: row.uploaderId,
    storageKey: row.storageKey, contentType: row.contentType,
    bytes: row.bytes, createdAt: row.createdAt,
  };
}

export class PrismaTaskImageRepository implements TaskImageRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(
    context: TransactionContext,
    input: Omit<TaskImageRecord, "createdAt">,
  ): Promise<TaskImageRecord> {
    return toDomain(await this.client(context).taskImage.create({ data: input }));
  }

  async findById(id: string): Promise<TaskImageRecord | null> {
    const row = await this.prisma.taskImage.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async listForTask(taskId: string): Promise<TaskImageRecord[]> {
    const rows = await this.prisma.taskImage.findMany({ where: { taskId } });
    return rows.map(toDomain);
  }

  /** Only unattached images, and only the uploader's own: a description cannot
   * adopt somebody else's upload, nor steal one already claimed by a task. */
  async claim(
    context: TransactionContext,
    taskId: string,
    uploaderId: string,
    imageIds: readonly string[],
  ): Promise<string[]> {
    const client = this.client(context);
    if (imageIds.length > 0) {
      await client.taskImage.updateMany({
        where: { id: { in: [...imageIds] }, taskId: null, uploaderId },
        data: { taskId },
      });
    }
    // Read inside the transaction: the claim above is not visible to a query
    // running outside it.
    const attached = await client.taskImage.findMany({
      where: { taskId }, select: { id: true }, orderBy: { createdAt: "asc" },
    });
    return attached.map((image) => image.id);
  }

  async deleteMany(context: TransactionContext, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.client(context).taskImage.deleteMany({ where: { id: { in: [...ids] } } });
  }
}

export class S3TaskImageStorage implements TaskImageStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    return putObject(key, bytes, contentType);
  }

  get(key: string) {
    return getObject(key);
  }

  remove(keys: readonly string[]): Promise<void> {
    return removeObjects(keys);
  }
}
