import { Prisma, type PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { DatasetInput, DatasetRepository } from '../application/ports.js';
import { DATASET_STATES, SEND_STATUSES, type DatasetState, type RecentSend, type SendStatus, type StoredDataset } from '../domain/conversions.js';

const datasetSelect = {
  projectId: true, orgId: true, datasetId: true, datasetName: true, encryptedToken: true, testEventCode: true,
  currency: true, state: true, lastError: true, lastSentAt: true, revision: true,
} satisfies Prisma.MetaDatasetSelect;
type DatasetRow = Prisma.MetaDatasetGetPayload<{ select: typeof datasetSelect }>;

const stateOf = (value: string): DatasetState => (DATASET_STATES as readonly string[]).includes(value) ? value as DatasetState : 'ACTIVE';
const statusOf = (value: string): SendStatus => (SEND_STATUSES as readonly string[]).includes(value) ? value as SendStatus : 'PENDING';
const toDataset = (row: DatasetRow): StoredDataset => ({ ...row, state: stateOf(row.state) });

export class PrismaDatasetRepository implements DatasetRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private client(context?: TransactionContext) {
    return context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  async find(projectId: string, context?: TransactionContext) {
    const row = await this.client(context).metaDataset.findUnique({ where: { projectId }, select: datasetSelect });
    return row && toDataset(row);
  }

  async save(context: TransactionContext, { tokenChanged, ...input }: DatasetInput) {
    const fields = {
      datasetId: input.datasetId, datasetName: input.datasetName, encryptedToken: input.encryptedToken,
      testEventCode: input.testEventCode, currency: input.currency, revision: input.revision,
      leaseOwner: null, leaseUntil: null,
      ...(tokenChanged ? { state: 'ACTIVE', lastError: null } : {}),
    };
    const row = await this.client(context).metaDataset.upsert({
      where: { projectId: input.projectId },
      create: { ...fields, projectId: input.projectId, orgId: input.orgId },
      update: fields,
      select: datasetSelect,
    });
    if (tokenChanged) {
      await this.client(context).metaConversionSend.updateMany({
        where: { projectId: input.projectId, status: 'PENDING' },
        data: { nextAttemptAt: new Date(0) },
      });
    }
    return toDataset(row);
  }

  async remove(context: TransactionContext, projectId: string) {
    const tx = this.client(context);
    await tx.metaConversionSend.deleteMany({ where: { projectId, status: { in: ['WAITING_AMOUNT', 'PENDING'] } } });
    await tx.metaDataset.delete({ where: { projectId } });
  }

  async timezone(projectId: string) {
    const connection = await this.prisma.projectIntegration.findFirst({
      where: { projectId, provider: 'META' }, orderBy: { createdAt: 'asc' }, select: { timezone: true },
    });
    return connection?.timezone ?? 'UTC';
  }

  async counts(projectId: string, timezone: string, today: string) {
    const [row] = await this.prisma.$queryRaw<Array<{ today: bigint; week: bigint; month: bigint }>>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "day" = ${today}::date) AS "today",
        count(*) FILTER (WHERE "day" >= ${today}::date - 6) AS "week",
        count(*) FILTER (WHERE "day" >= ${today}::date - 29) AS "month"
      FROM (
        SELECT (("sent_at" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date AS "day"
        FROM "meta_conversion_send"
        WHERE "project_id" = ${projectId} AND "status" = 'SENT' AND "sent_at" >= ${today}::date - 31
      ) sent`);
    return { today: Number(row?.today ?? 0), week: Number(row?.week ?? 0), month: Number(row?.month ?? 0) };
  }

  async recent(projectId: string, limit: number): Promise<RecentSend[]> {
    const rows = await this.prisma.metaConversionSend.findMany({
      where: { projectId },
      orderBy: [{ reachedAt: 'desc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, leadId: true, eventName: true, reachedAt: true, status: true, lastError: true, sentAt: true, lead: { select: { name: true } } },
    });
    return rows.map(({ lead, status, ...send }) => ({ ...send, leadName: lead.name, status: statusOf(status) }));
  }
}
