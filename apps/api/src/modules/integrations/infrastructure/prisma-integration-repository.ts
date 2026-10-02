import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { ConnectionData, IntegrationRepository } from "../application/ports.js";

const fresh = (now: Date) => ({
  revision: randomUUID(), status: "QUEUED", retryCount: 0, lastError: null, lastSuccessAt: null, leaseOwner: null, leaseUntil: null,
  leadsStatus: "WAITING", leadsLastError: null, nextLeadsAt: now, leadsQueuedAt: null, leadsLeaseOwner: null, leadsLeaseUntil: null,
});
const uncovered = { leadsCoveredUntil: null, leadsLastSuccessAt: null, nextSweepAt: null };

export class PrismaIntegrationRepository implements IntegrationRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  list(projectId: string) {
    return this.prisma.projectIntegration.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }
  read(projectId: string, id: string) {
    return this.prisma.projectIntegration.findFirst({ where: { id, projectId } });
  }
  async add(context: TransactionContext, input: ConnectionData, now: Date) {
    return this.unitOfWork.clientFor(context).projectIntegration.create({ data: { ...input, ...fresh(now), ...uncovered } });
  }
  async replace(context: TransactionContext, id: string, input: ConnectionData, now: Date) {
    const client = this.unitOfWork.clientFor(context);
    const existing = await client.projectIntegration.findUniqueOrThrow({ where: { id }, select: { accountId: true } });
    const coverage = existing.accountId === input.accountId ? {} : uncovered;
    return client.projectIntegration.update({ where: { id }, data: { ...input, ...fresh(now), ...coverage } });
  }
  async remove(context: TransactionContext, id: string) {
    await this.unitOfWork.clientFor(context).projectIntegration.deleteMany({ where: { id } });
  }
  async holdsFigures(projectId: string) {
    const figure = await this.prisma.campaignDailyMetric.findFirst({ where: { campaign: { projectId } }, select: { date: true } });
    return figure !== null;
  }
  async adoptCurrency(context: TransactionContext, projectId: string, currency: string) {
    await this.unitOfWork.clientFor(context).project.update({ where: { id: projectId }, data: { budgetCurrency: currency } });
  }
  async queue(id: string, now: Date) {
    await this.prisma.projectIntegration.updateMany({ where: { id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }], status: { not: "QUEUED" } }, data: { queuedAt: now, status: "QUEUED", retryCount: 0, lastError: null } });
    await this.prisma.projectIntegration.updateMany({ where: { id, leadsEnabled: true }, data: { leadsQueuedAt: now } });
  }
  async setLeadsEnabled(id: string, enabled: boolean, now: Date) {
    await this.prisma.projectIntegration.update({ where: { id }, data: { leadsEnabled: enabled, ...(enabled ? { leadsQueuedAt: now } : {}) } });
  }
}
