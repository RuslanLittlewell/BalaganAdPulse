import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { KpiRepository } from '../application/ports.js';
import { MANUAL_KPI, type Kpi, type KpiOwner } from '../domain/kpi.js';

type KpiColumns = {
  kpiMetric: Kpi['metric'] | null;
  kpiTarget: Prisma.Decimal | null;
  kpiUpdatedAt: Date | null;
  kpiName?: string | null;
  kpiValue?: Prisma.Decimal | null;
};
const columns = { kpiMetric: true, kpiTarget: true, kpiUpdatedAt: true } as const;
const projectColumns = { ...columns, kpiName: true, kpiValue: true } as const;

function toKpi(row: KpiColumns | null): Kpi | null {
  if (!row?.kpiMetric || !row.kpiTarget) return null;
  const target = row.kpiTarget.toFixed(4);
  const updatedAt = row.kpiUpdatedAt ?? new Date(0);
  if (row.kpiMetric !== MANUAL_KPI) return { metric: row.kpiMetric, target, updatedAt };
  if (row.kpiName == null || !row.kpiValue) return null;
  return { metric: MANUAL_KPI, name: row.kpiName, value: row.kpiValue.toFixed(4), target, updatedAt };
}

export class PrismaKpiRepository implements KpiRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async read(owner: KpiOwner) {
    const where = { id: owner.entityId };
    if (owner.entityType === 'organization') return toKpi(await this.prisma.organization.findUnique({ where, select: columns }));
    if (owner.entityType === 'project') return toKpi(await this.prisma.project.findUnique({ where, select: projectColumns }));
    return toKpi(await this.prisma.campaign.findUnique({ where, select: columns }));
  }

  async write(context: TransactionContext, owner: KpiOwner, kpi: Kpi | null) {
    const client = this.unitOfWork.clientFor(context);
    const data = { kpiMetric: kpi?.metric ?? null, kpiTarget: kpi?.target ?? null, kpiUpdatedAt: kpi?.updatedAt ?? null };
    const where = { id: owner.entityId };
    const manual = kpi?.metric === MANUAL_KPI ? kpi : null;
    if (owner.entityType === 'organization') await client.organization.update({ where, data });
    else if (owner.entityType === 'project') await client.project.update({ where, data: { ...data, kpiName: manual?.name ?? null, kpiValue: manual?.value ?? null } });
    else await client.campaign.update({ where, data });
  }
}
