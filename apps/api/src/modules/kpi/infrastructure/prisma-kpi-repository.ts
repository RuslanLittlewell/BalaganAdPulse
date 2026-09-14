import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { KpiRepository } from '../application/ports.js';
import type { Kpi, KpiOwner } from '../domain/kpi.js';

type KpiColumns = { kpiMetric: Kpi['metric'] | null; kpiTarget: Prisma.Decimal | null; kpiUpdatedAt: Date | null };
const columns = { kpiMetric: true, kpiTarget: true, kpiUpdatedAt: true } as const;

function toKpi(row: KpiColumns | null): Kpi | null {
  if (!row?.kpiMetric || !row.kpiTarget) return null;
  return { metric: row.kpiMetric, target: row.kpiTarget.toFixed(4), updatedAt: row.kpiUpdatedAt ?? new Date(0) };
}

export class PrismaKpiRepository implements KpiRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async read(owner: KpiOwner) {
    const where = { where: { id: owner.entityId }, select: columns };
    if (owner.entityType === 'organization') return toKpi(await this.prisma.organization.findUnique(where));
    if (owner.entityType === 'project') return toKpi(await this.prisma.project.findUnique(where));
    return toKpi(await this.prisma.campaign.findUnique(where));
  }

  async write(context: TransactionContext, owner: KpiOwner, kpi: Kpi | null) {
    const client = this.unitOfWork.clientFor(context);
    const data = { kpiMetric: kpi?.metric ?? null, kpiTarget: kpi?.target ?? null, kpiUpdatedAt: kpi?.updatedAt ?? null };
    const where = { id: owner.entityId };
    if (owner.entityType === 'organization') await client.organization.update({ where, data });
    else if (owner.entityType === 'project') await client.project.update({ where, data });
    else await client.campaign.update({ where, data });
  }
}
