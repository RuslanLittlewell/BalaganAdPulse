import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { IntegrationRepository } from "../application/ports.js";

export class PrismaIntegrationRepository implements IntegrationRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  read(projectId: string) { return this.prisma.projectIntegration.findUnique({ where: { projectId } }); }
  async save(context: TransactionContext, input: Parameters<IntegrationRepository["save"]>[1], now: Date) {
    const client = this.unitOfWork.clientFor(context);
    const existing = await client.projectIntegration.findUnique({ where: { projectId: input.projectId }, select: { accountId: true } });
    const leads = { leadsStatus: "WAITING", leadsLastError: null, nextLeadsAt: now, leadsQueuedAt: null, leadsLeaseOwner: null, leadsLeaseUntil: null };
    const coverage = existing?.accountId === input.accountId ? {} : { leadsCoveredUntil: null, leadsLastSuccessAt: null, nextSweepAt: null };
    const data = { ...input, revision: randomUUID(), status: "QUEUED", retryCount: 0, lastError: null, lastSuccessAt: null, leaseOwner: null, leaseUntil: null, ...leads, ...coverage };
    return client.projectIntegration.upsert({ where: { projectId: input.projectId }, create: data, update: data });
  }
  async remove(context: TransactionContext, projectId: string) {
    await this.unitOfWork.clientFor(context).projectIntegration.deleteMany({ where: { projectId } });
  }
  async queue(projectId: string, now: Date) {
    await this.prisma.projectIntegration.updateMany({ where: { projectId, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }], status: { not: "QUEUED" } }, data: { queuedAt: now, status: "QUEUED", retryCount: 0, lastError: null } });
    await this.prisma.projectIntegration.updateMany({ where: { projectId }, data: { leadsQueuedAt: now } });
  }
}
