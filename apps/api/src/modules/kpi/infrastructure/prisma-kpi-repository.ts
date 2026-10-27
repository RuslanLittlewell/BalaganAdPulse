import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { KpiRepository, ProjectKpiRepository } from '../application/ports.js';
import { RESULT_TYPES, type Channel, type ResultType } from '#modules/campaigns/index.js';
import { MANUAL_KPI, type Kpi, type KpiOwner, type NewProjectKpi, type ProjectKpi } from '../domain/kpi.js';

type KpiColumns = {
  kpiMetric: Kpi['metric'] | null;
  kpiTarget: Prisma.Decimal | null;
  kpiUpdatedAt: Date | null;
  kpiResultType?: string | null;
};
const columns = { kpiMetric: true, kpiTarget: true, kpiUpdatedAt: true } as const;
const campaignColumns = { ...columns, kpiResultType: true } as const;

type ProjectKpiRow = {
  id: string;
  metric: Kpi['metric'];
  target: Prisma.Decimal;
  name: string | null;
  value: Prisma.Decimal | null;
  enabled: boolean;
  resultType: string | null;
  channel: Channel | null;
  sourceAccountId: string | null;
  updatedAt: Date;
};

const isResultType = (value: string | null | undefined): value is ResultType =>
  value != null && (RESULT_TYPES as readonly string[]).includes(value);

function toKpi(row: KpiColumns | null): Kpi | null {
  if (!row?.kpiMetric || !row.kpiTarget || row.kpiMetric === MANUAL_KPI) return null;
  const kpi = { metric: row.kpiMetric, target: row.kpiTarget.toFixed(4), updatedAt: row.kpiUpdatedAt ?? new Date(0) };
  return isResultType(row.kpiResultType) ? { ...kpi, resultType: row.kpiResultType } : kpi;
}

function toProjectKpi(row: ProjectKpiRow): ProjectKpi | null {
  const account = row.channel && row.sourceAccountId ? { channel: row.channel, accountId: row.sourceAccountId } : null;
  const base = { id: row.id, enabled: row.enabled, account, updatedAt: row.updatedAt, target: row.target.toFixed(4) };
  if (row.metric !== MANUAL_KPI) {
    return isResultType(row.resultType) ? { ...base, metric: row.metric, resultType: row.resultType } : { ...base, metric: row.metric };
  }
  if (row.name == null || !row.value) return null;
  return { ...base, metric: MANUAL_KPI, name: row.name, value: row.value.toFixed(4) };
}

export class PrismaKpiRepository implements KpiRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async read(owner: KpiOwner) {
    const where = { id: owner.entityId };
    if (owner.entityType === 'organization') return toKpi(await this.prisma.organization.findUnique({ where, select: columns }));
    return toKpi(await this.prisma.campaign.findUnique({ where, select: campaignColumns }));
  }

  async write(context: TransactionContext, owner: KpiOwner, kpi: Kpi | null) {
    const client = this.unitOfWork.clientFor(context);
    const data = { kpiMetric: kpi?.metric ?? null, kpiTarget: kpi?.target ?? null, kpiUpdatedAt: kpi?.updatedAt ?? null };
    const where = { id: owner.entityId };
    if (owner.entityType === 'organization') await client.organization.update({ where, data });
    else {
      const kpiResultType = kpi && kpi.metric !== MANUAL_KPI ? kpi.resultType ?? null : null;
      await client.campaign.update({ where, data: { ...data, kpiResultType } });
    }
  }
}

export class PrismaProjectKpiRepository implements ProjectKpiRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async list(projectId: string) {
    const rows = await this.prisma.projectKpi.findMany({ where: { projectId }, orderBy: { position: 'asc' } });
    return rows.flatMap((row) => toProjectKpi(row) ?? []);
  }

  async replace(context: TransactionContext, projectId: string, kpis: readonly NewProjectKpi[]) {
    const client = this.unitOfWork.clientFor(context);
    await client.projectKpi.deleteMany({ where: { projectId } });
    await client.projectKpi.createMany({
      data: kpis.map((kpi, position) => ({
        projectId,
        position,
        metric: kpi.metric,
        target: kpi.target,
        name: kpi.metric === MANUAL_KPI ? kpi.name : null,
        value: kpi.metric === MANUAL_KPI ? kpi.value : null,
        enabled: kpi.enabled,
        resultType: kpi.metric !== MANUAL_KPI ? kpi.resultType ?? null : null,
        channel: kpi.account?.channel ?? null,
        sourceAccountId: kpi.account?.accountId ?? null,
        updatedAt: kpi.updatedAt,
      })),
    });
  }
}
