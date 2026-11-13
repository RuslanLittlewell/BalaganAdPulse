import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { ReachedEvent } from '#modules/leads/index.js';
import type { ConversionJobs } from '../application/ports.js';
import { AMOUNT_HOLD_MS, EXPIRED_REASON, expiryCutoff, retryDelay, type DatasetJob, type DueSend } from '../domain/conversions.js';

const LEASE_MS = 180_000;
const leaseUntil = (now: Date) => new Date(now.getTime() + LEASE_MS);

const dueSend = (now: Date): Prisma.MetaConversionSendWhereInput => ({
  OR: [
    { status: 'PENDING', nextAttemptAt: { lte: now } },
    { status: 'WAITING_AMOUNT', OR: [{ holdUntil: { lte: now } }, { lead: { amount: { gt: 0 } } }] },
  ],
});

export class PrismaConversionJobs implements ConversionJobs {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private tx(context: TransactionContext) {
    return this.uow.clientFor<Prisma.TransactionClient>(context);
  }

  private owned(job: DatasetJob): Prisma.MetaConversionSendWhereInput {
    return { projectId: job.projectId, project: { metaDataset: { is: { leaseOwner: job.leaseOwner, revision: job.revision } } } };
  }

  async queue(context: TransactionContext, reached: readonly ReachedEvent[], now: Date) {
    if (reached.length === 0) return 0;
    const leads = await this.tx(context).lead.findMany({
      where: { id: { in: [...new Set(reached.map((event) => event.leadId))] }, metaKey: { isNot: null }, project: { metaDataset: { isNot: null } } },
      select: { id: true, amount: true },
    });
    const amounts = new Map(leads.map((lead) => [lead.id, lead.amount]));
    const rows = reached.filter((event) => amounts.has(event.leadId)).map((event) => {
      const amount = amounts.get(event.leadId);
      const waits = event.carriesAmount && !(amount && amount.greaterThan(0));
      return {
        orgId: event.orgId, projectId: event.projectId, leadId: event.leadId, eventId: event.eventId, eventName: event.eventName,
        reachedAt: event.reachedAt, status: waits ? 'WAITING_AMOUNT' : 'PENDING',
        holdUntil: waits ? new Date(event.reachedAt.getTime() + AMOUNT_HOLD_MS) : null, nextAttemptAt: now,
      };
    });
    if (rows.length === 0) return 0;
    return (await this.tx(context).metaConversionSend.createMany({ data: rows, skipDuplicates: true })).count;
  }

  async claimChanges(context: TransactionContext, limit: number) {
    const rows = await this.tx(context).$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "lead_stage_change" WHERE "processed_at" IS NULL
      ORDER BY "changed_at" LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
    return rows.map((row) => row.id);
  }

  async markProcessed(context: TransactionContext, changeIds: readonly string[], now: Date) {
    if (changeIds.length === 0) return;
    await this.tx(context).leadStageChange.updateMany({ where: { id: { in: [...changeIds] } }, data: { processedAt: now } });
  }

  async expire(now: Date) {
    const { count } = await this.prisma.metaConversionSend.updateMany({
      where: { status: { in: ['WAITING_AMOUNT', 'PENDING'] }, reachedAt: { lt: expiryCutoff(now) } },
      data: { status: 'EXPIRED', lastError: EXPIRED_REASON },
    });
    return count;
  }

  async claim(now: Date): Promise<DatasetJob | null> {
    const available: Prisma.MetaDatasetWhereInput = {
      state: 'ACTIVE',
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      project: { conversionSends: { some: dueSend(now) } },
    };
    const candidate = await this.prisma.metaDataset.findFirst({ where: available, orderBy: { lastSentAt: { sort: 'asc', nulls: 'first' } } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.metaDataset.updateMany({
      where: { ...available, projectId: candidate.projectId, revision: candidate.revision, leaseOwner: candidate.leaseOwner },
      data: { leaseOwner: owner, leaseUntil: leaseUntil(now) },
    });
    if (!claimed.count) return null;
    return {
      projectId: candidate.projectId, datasetId: candidate.datasetId, encryptedToken: candidate.encryptedToken,
      testEventCode: candidate.testEventCode, currency: candidate.currency, revision: candidate.revision, leaseOwner: owner,
    };
  }

  async due(job: DatasetJob, now: Date, limit: number): Promise<DueSend[]> {
    const rows = await this.prisma.metaConversionSend.findMany({
      where: { ...this.owned(job), ...dueSend(now) },
      orderBy: [{ reachedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true, leadId: true, eventName: true, reachedAt: true,
        event: { select: { carriesAmount: true } },
        lead: { select: { amount: true, metaKey: { select: { externalId: true } }, person: { select: { phoneDigits: true, email: true } } } },
      },
    });
    return rows.flatMap(({ event, lead, ...send }) => lead.metaKey ? [{
      ...send,
      carriesAmount: event?.carriesAmount ?? false,
      metaLeadId: lead.metaKey.externalId,
      phoneDigits: lead.person?.phoneDigits ?? null,
      email: lead.person?.email ?? null,
      amount: lead.amount === null ? null : lead.amount.toFixed(4),
    }] : []);
  }

  async sent(job: DatasetJob, sends: readonly { id: string; value: number | null; currency: string | null }[], now: Date) {
    if (sends.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const send of sends) {
        await tx.metaConversionSend.updateMany({
          where: { ...this.owned(job), id: send.id },
          data: { status: 'SENT', sentAt: now, value: send.value, currency: send.currency, test: job.testEventCode !== null, lastError: null },
        });
      }
      await tx.metaDataset.updateMany({
        where: { projectId: job.projectId, leaseOwner: job.leaseOwner, revision: job.revision },
        data: { lastSentAt: now, lastError: null, leaseUntil: leaseUntil(now) },
      });
    });
  }

  async refused(job: DatasetJob, sendId: string, reason: string, _now: Date) {
    await this.prisma.metaConversionSend.updateMany({ where: { ...this.owned(job), id: sendId }, data: { status: 'FAILED', lastError: reason } });
  }

  async retry(job: DatasetJob, sendIds: readonly string[], reason: string, now: Date) {
    if (sendIds.length === 0) return;
    const sends = await this.prisma.metaConversionSend.findMany({ where: { ...this.owned(job), id: { in: [...sendIds] } }, select: { id: true, attempts: true } });
    await this.prisma.$transaction(async (tx) => {
      for (const send of sends) {
        await tx.metaConversionSend.updateMany({
          where: { ...this.owned(job), id: send.id },
          data: { status: 'PENDING', attempts: send.attempts + 1, nextAttemptAt: new Date(now.getTime() + retryDelay(send.attempts)), lastError: reason },
        });
      }
    });
  }

  async requireToken(job: DatasetJob, reason: string, _now: Date) {
    await this.prisma.metaDataset.updateMany({
      where: { projectId: job.projectId, leaseOwner: job.leaseOwner, revision: job.revision },
      data: { state: 'AUTH_REQUIRED', lastError: reason },
    });
  }

  async release(job: DatasetJob) {
    await this.prisma.metaDataset.updateMany({
      where: { projectId: job.projectId, leaseOwner: job.leaseOwner },
      data: { leaseOwner: null, leaseUntil: null },
    });
  }
}
