import { Prisma, type PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { ConversionEventRepository, ConversionReach } from '../application/ports.js';
import { nameKeyOf, type ConversionEventRecord, type ReachedEvent } from '../domain/conversion-event.js';

const eventSelect = { id: true, projectId: true, name: true, stages: true, carriesAmount: true, createdAt: true, updatedAt: true } satisfies Prisma.CrmConversionEventSelect;

const firstEntries = (scope: Prisma.Sql) => Prisma.sql`
  SELECT DISTINCT ON (c."lead_id", e."id")
    c."org_id" AS "orgId", c."project_id" AS "projectId", c."lead_id" AS "leadId",
    e."id" AS "eventId", e."name" AS "eventName", e."carries_amount" AS "carriesAmount", c."changed_at" AS "reachedAt"
  FROM "lead_stage_change" c
  JOIN "crm_conversion_event" e ON e."project_id" = c."project_id" AND c."to_stage" = ANY(e."stages")
  WHERE ${scope}
    AND NOT EXISTS (
      SELECT 1 FROM "lead_stage_change" p
      WHERE p."lead_id" = c."lead_id" AND p."to_stage" = ANY(e."stages") AND p."changed_at" < c."changed_at"
    )
  ORDER BY c."lead_id", e."id", c."changed_at"`;

export class PrismaConversionEventRepository implements ConversionEventRepository, ConversionReach {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private client(context?: TransactionContext) {
    return context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  list(projectId: string, context?: TransactionContext): Promise<ConversionEventRecord[]> {
    return this.client(context).crmConversionEvent.findMany({ where: { projectId }, select: eventSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  create(context: TransactionContext, input: Parameters<ConversionEventRepository['create']>[1]): Promise<ConversionEventRecord> {
    return this.client(context).crmConversionEvent.create({ data: { ...input, nameKey: nameKeyOf(input.name) }, select: eventSelect });
  }

  update(context: TransactionContext, id: string, input: Parameters<ConversionEventRepository['update']>[2]): Promise<ConversionEventRecord> {
    return this.client(context).crmConversionEvent.update({ where: { id }, data: { ...input, nameKey: nameKeyOf(input.name) }, select: eventSelect });
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).crmConversionEvent.delete({ where: { id } });
  }

  reachedByChanges(context: TransactionContext, changeIds: readonly string[]): Promise<ReachedEvent[]> {
    if (changeIds.length === 0) return Promise.resolve([]);
    return this.client(context).$queryRaw<ReachedEvent[]>(firstEntries(Prisma.sql`c."id" = ANY(${[...changeIds]}::text[])`));
  }

  reachedSince(context: TransactionContext, projectId: string, since: Date): Promise<ReachedEvent[]> {
    return this.client(context).$queryRaw<ReachedEvent[]>(firstEntries(Prisma.sql`c."project_id" = ${projectId} AND c."changed_at" >= ${since}`));
  }
}
