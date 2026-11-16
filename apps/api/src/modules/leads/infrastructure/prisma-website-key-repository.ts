import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { WebsiteKeyRepository } from '../application/website-intake-use-cases.js';
import type { LiveWebsiteKey, WebsiteKey } from '../domain/website-intake.js';

const SHOWN = { key: true, allowedSites: true, createdAt: true, rotatedAt: true } as const;

export class PrismaWebsiteKeyRepository implements WebsiteKeyRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private client(context?: TransactionContext): Prisma.TransactionClient | PrismaClient {
    return context ? this.unitOfWork.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  find(projectId: string, context?: TransactionContext): Promise<WebsiteKey | null> {
    return this.client(context).leadIntakeKey.findUnique({ where: { projectId }, select: SHOWN });
  }

  create(context: TransactionContext, input: { id: string; projectId: string; key: string }): Promise<WebsiteKey> {
    return this.client(context).leadIntakeKey.create({ data: input, select: SHOWN });
  }

  rotate(context: TransactionContext, projectId: string, key: string): Promise<WebsiteKey> {
    return this.client(context).leadIntakeKey.update({ where: { projectId }, data: { key, rotatedAt: new Date() }, select: SHOWN });
  }

  setSites(context: TransactionContext, projectId: string, sites: string[]): Promise<WebsiteKey> {
    return this.client(context).leadIntakeKey.update({ where: { projectId }, data: { allowedSites: sites }, select: SHOWN });
  }

  async remove(context: TransactionContext, projectId: string): Promise<void> {
    await this.client(context).leadIntakeKey.delete({ where: { projectId } });
  }

  async findLive(key: string): Promise<LiveWebsiteKey | null> {
    const row = await this.prisma.leadIntakeKey.findFirst({
      where: { key, project: { client: { org: { status: 'ACTIVE' } } } },
      select: { projectId: true, allowedSites: true, project: { select: { client: { select: { orgId: true } } } } },
    });
    return row && { projectId: row.projectId, orgId: row.project.client.orgId, allowedSites: row.allowedSites };
  }
}
