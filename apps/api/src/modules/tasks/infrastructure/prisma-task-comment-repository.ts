import type { Prisma, PrismaClient, TaskComment as CommentRow } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { NewTaskComment, TaskCommentRecord, TaskCommentRepository } from "../application/ports.js";

const WITH_AUTHOR = { author: { select: { user: { select: { name: true } } } } } as const;

type Row = CommentRow & { author: { user: { name: string } } | null };

function toDomain(row: Row): TaskCommentRecord {
  return {
    id: row.id, taskId: row.taskId, authorId: row.authorId, authorName: row.author?.user.name ?? null,
    body: row.body, mentionIds: row.mentionIds, createdAt: row.createdAt, editedAt: row.editedAt,
  };
}

export class PrismaTaskCommentRepository implements TaskCommentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async list(taskId: string): Promise<TaskCommentRecord[]> {
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: WITH_AUTHOR,
    });
    return rows.map(toDomain);
  }

  async find(taskId: string, id: string): Promise<TaskCommentRecord | null> {
    const row = await this.prisma.taskComment.findFirst({ where: { id, taskId }, include: WITH_AUTHOR });
    return row && toDomain(row);
  }

  async create(context: TransactionContext, input: NewTaskComment): Promise<TaskCommentRecord> {
    const row = await this.client(context).taskComment.create({
      data: {
        id: input.id, taskId: input.taskId, authorId: input.authorId, body: input.body,
        mentionIds: [...input.mentionIds],
      },
      include: WITH_AUTHOR,
    });
    return toDomain(row);
  }

  async edit(
    context: TransactionContext,
    id: string,
    changes: { body: string; mentionIds: readonly string[]; editedAt: Date },
  ): Promise<TaskCommentRecord> {
    const row = await this.client(context).taskComment.update({
      where: { id },
      data: { body: changes.body, mentionIds: [...changes.mentionIds], editedAt: changes.editedAt },
      include: WITH_AUTHOR,
    });
    return toDomain(row);
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).taskComment.delete({ where: { id } });
  }
}
