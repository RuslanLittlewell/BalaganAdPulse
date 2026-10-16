import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { ProjectDocumentRepository } from "../application/ports.js";
import type {
  DocumentAuthor,
  DocumentChange,
  DocumentSummary,
  ProjectDocument,
} from "../domain/project-document.js";

const AUTHOR = { select: { id: true, user: { select: { name: true } } } } as const;

type AuthorRow = { id: string; user: { name: string } } | null;

const authorOf = (row: AuthorRow): DocumentAuthor | null => row && { id: row.id, name: row.user.name };

const SUMMARY = {
  id: true, projectId: true, title: true, createdAt: true, updatedAt: true, updatedBy: AUTHOR,
} as const;

const FULL = { ...SUMMARY, content: true, createdBy: AUTHOR } as const;

type SummaryRow = Prisma.ProjectDocumentGetPayload<{ select: typeof SUMMARY }>;
type FullRow = Prisma.ProjectDocumentGetPayload<{ select: typeof FULL }>;

const toSummary = (row: SummaryRow): DocumentSummary => ({
  id: row.id, projectId: row.projectId, title: row.title,
  createdAt: row.createdAt, updatedAt: row.updatedAt, updatedBy: authorOf(row.updatedBy),
});

const toDocument = (row: FullRow): ProjectDocument => ({
  ...toSummary(row), content: row.content ?? null, createdBy: authorOf(row.createdBy),
});

export class PrismaProjectDocumentRepository implements ProjectDocumentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async list(projectId: string): Promise<DocumentSummary[]> {
    const rows = await this.prisma.projectDocument.findMany({
      where: { projectId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: SUMMARY,
    });
    return rows.map(toSummary);
  }

  async find(projectId: string, id: string): Promise<ProjectDocument | null> {
    const row = await this.prisma.projectDocument.findFirst({ where: { id, projectId }, select: FULL });
    return row && toDocument(row);
  }

  async create(
    context: TransactionContext,
    input: { id: string; projectId: string; title: string; authorId: string },
  ): Promise<ProjectDocument> {
    const row = await this.client(context).projectDocument.create({
      data: {
        id: input.id, projectId: input.projectId, title: input.title,
        createdById: input.authorId, updatedById: input.authorId,
      },
      select: FULL,
    });
    return toDocument(row);
  }

  async update(
    context: TransactionContext,
    id: string,
    change: DocumentChange & { editorId: string },
  ): Promise<ProjectDocument> {
    const row = await this.client(context).projectDocument.update({
      where: { id },
      data: {
        ...(change.title === undefined ? {} : { title: change.title }),
        ...(change.content === undefined
          ? {}
          : { content: change.content === null ? Prisma.DbNull : (change.content as Prisma.InputJsonValue) }),
        updatedById: change.editorId,
      },
      select: FULL,
    });
    return toDocument(row);
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).projectDocument.delete({ where: { id } });
  }
}
