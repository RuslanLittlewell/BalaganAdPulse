import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { ShareLinkRepository, ShareTokenSource } from "../application/ports.js";
import type { LiveShareLink, ShareLink } from "../domain/share-link.js";

const SHOWN = { token: true, createdAt: true } as const;

export class PrismaShareLinkRepository implements ShareLinkRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context?: TransactionContext): Prisma.TransactionClient | PrismaClient {
    return context ? this.unitOfWork.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  find(projectId: string, context?: TransactionContext): Promise<ShareLink | null> {
    return this.client(context).projectShareLink.findUnique({ where: { projectId }, select: SHOWN });
  }

  create(
    context: TransactionContext,
    input: { id: string; projectId: string; token: string; createdById: string },
  ): Promise<ShareLink> {
    return this.client(context).projectShareLink.create({ data: input, select: SHOWN });
  }

  renew(context: TransactionContext, projectId: string, token: string): Promise<ShareLink> {
    return this.client(context).projectShareLink.update({
      where: { projectId }, data: { token, createdAt: new Date() }, select: SHOWN,
    });
  }

  async remove(context: TransactionContext, projectId: string): Promise<void> {
    await this.client(context).projectShareLink.delete({ where: { projectId } });
  }

  async findLive(token: string): Promise<LiveShareLink | null> {
    const row = await this.prisma.projectShareLink.findFirst({
      where: { token, project: { client: { org: { status: "ACTIVE" } } } },
      select: { id: true, projectId: true, project: { select: { client: { select: { orgId: true } } } } },
    });
    return row && { id: row.id, projectId: row.projectId, orgId: row.project.client.orgId };
  }
}

export class RandomShareTokens implements ShareTokenSource {
  issue(): string {
    return randomBytes(32).toString("base64url");
  }
}
