import type { PrismaClient, TaskComment as CommentRow } from "@prisma/client";
import type { NewTaskComment, TaskCommentRecord, TaskCommentRepository } from "../application/ports.js";

function toDomain(row: CommentRow): TaskCommentRecord {
  return {
    id: row.id, taskId: row.taskId, authorId: row.authorId, body: row.body,
    mentionIds: row.mentionIds, createdAt: row.createdAt,
  };
}

export class PrismaTaskCommentRepository implements TaskCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(taskId: string): Promise<TaskCommentRecord[]> {
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toDomain);
  }

  async find(taskId: string, id: string): Promise<TaskCommentRecord | null> {
    const row = await this.prisma.taskComment.findFirst({ where: { id, taskId } });
    return row && toDomain(row);
  }

  async create(input: NewTaskComment): Promise<TaskCommentRecord> {
    const row = await this.prisma.taskComment.create({
      data: {
        id: input.id, taskId: input.taskId, authorId: input.authorId, body: input.body,
        mentionIds: [...input.mentionIds],
      },
    });
    return toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.taskComment.delete({ where: { id } });
  }
}
