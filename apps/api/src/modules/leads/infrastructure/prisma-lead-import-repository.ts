import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { ImportedLeadWrite, LeadImportRepository } from '../application/lead-import-use-cases.js';
import { phoneDigitsOf } from '../domain/crm-record.js';
import { placementOf } from '../domain/lead.js';
import { leadNameOf } from '../domain/website-intake.js';

const BATCH = 1000;

function batches<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += BATCH) result.push(items.slice(start, start + BATCH));
  return result;
}

export class PrismaLeadImportRepository implements LeadImportRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  private client(context?: TransactionContext): Prisma.TransactionClient {
    return context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma;
  }

  async project(projectId: string) {
    return this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { clientId: true, name: true } });
  }

  async catalog(projectId: string, externalIds: readonly string[], context?: TransactionContext) {
    const db = this.client(context);
    const ids = [...externalIds];
    const campaigns = await db.campaign.findMany({ where: { projectId }, select: { id: true, name: true, externalId: true }, orderBy: { position: 'asc' } });
    const adSets = ids.length === 0 ? [] : await db.adSet.findMany({
      where: { externalId: { in: ids }, campaign: { projectId } },
      select: { externalId: true, campaignId: true },
    });
    const ads = ids.length === 0 ? [] : await db.ad.findMany({
      where: { externalId: { in: ids }, adSet: { campaign: { projectId } } },
      select: { id: true, externalId: true, adSet: { select: { campaignId: true } } },
    });
    return {
      campaigns,
      adSets: new Map(adSets.flatMap((adSet) => (adSet.externalId ? [[adSet.externalId, adSet.campaignId] as const] : []))),
      ads: new Map(ads.flatMap((ad) => (ad.externalId ? [[ad.externalId, { campaignId: ad.adSet.campaignId, adId: ad.id }] as const] : []))),
    };
  }

  async contacts(projectId: string, context?: TransactionContext) {
    const rows = await this.client(context).$queryRaw<Array<{ email: string | null; digits: string | null }>>`
      SELECT lower(btrim(person.email)) AS email, person.phone_digits AS digits
      FROM lead JOIN crm_person person ON person.id = lead.person_id
      WHERE lead.project_id = ${projectId}`;
    return {
      emails: new Set(rows.flatMap((row) => (row.email ? [row.email] : []))),
      phones: new Set(rows.flatMap((row) => (row.digits ? [row.digits] : []))),
    };
  }

  async ownColumns(projectId: string, context?: TransactionContext) {
    return this.client(context).leadColumn.findMany({ where: { projectId }, select: { id: true, name: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  }

  async claimed(orgId: string, keys: readonly string[], context?: TransactionContext) {
    const db = this.client(context);
    const found = new Set<string>();
    for (const batch of batches(keys)) {
      const rows = await db.metaLead.findMany({ where: { orgId, externalId: { in: batch } }, select: { externalId: true } });
      for (const row of rows) found.add(row.externalId);
    }
    return found;
  }

  async lock(context: TransactionContext, orgId: string, projectId: string) {
    await this.client(context).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgId + ':' + projectId}, 0))`;
  }

  async write(context: TransactionContext, input: { orgId: string; projectId: string; clientId: string; leads: readonly ImportedLeadWrite[] }) {
    const tx = this.client(context);
    const { orgId, projectId, clientId, leads } = input;
    const people = await tx.$queryRaw<Array<{ id: string; email: string | null; digits: string | null }>>`
      SELECT id, lower(btrim(email)) AS email, phone_digits AS digits FROM crm_person
      WHERE org_id = ${orgId} AND client_id = ${clientId} ORDER BY created_at, id`;
    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const person of people) {
      if (person.email && !byEmail.has(person.email)) byEmail.set(person.email, person.id);
      if (person.digits && !byPhone.has(person.digits)) byPhone.set(person.digits, person.id);
    }
    const created: Prisma.PersonCreateManyInput[] = [];
    const personOf = new Map<string, string>();
    for (const lead of leads) {
      const email = lead.row.email?.toLowerCase();
      const digits = phoneDigitsOf(lead.row.phone);
      const found = (email && byEmail.get(email)) || (digits && byPhone.get(digits));
      if (found) {
        personOf.set(lead.id, found);
        continue;
      }
      const id = randomUUID();
      created.push({ id, orgId, clientId, name: leadNameOf(lead.row), email: lead.row.email, phone: lead.row.phone });
      personOf.set(lead.id, id);
    }
    for (const batch of batches(created)) await tx.person.createMany({ data: batch });
    const arriving = new Map<string, number>();
    for (const lead of leads) arriving.set(lead.column, (arriving.get(lead.column) ?? 0) + 1);
    for (const [column, count] of arriving) {
      const { stage, columnId } = placementOf(column);
      if (stage) await tx.$executeRaw`UPDATE lead SET position = position + ${count} WHERE org_id = ${orgId} AND project_id = ${projectId} AND stage = ${stage}::lead_stage`;
      else await tx.$executeRaw`UPDATE lead SET position = position + ${count} WHERE org_id = ${orgId} AND project_id = ${projectId} AND column_id = ${columnId}`;
    }
    for (const batch of batches(leads)) {
      await tx.lead.createMany({ data: batch.map((lead) => ({
        id: lead.id, orgId, projectId, campaignId: lead.campaignId, adId: lead.adId, origin: 'IMPORT' as const,
        ...placementOf(lead.column), position: lead.position, name: leadNameOf(lead.row), personId: personOf.get(lead.id)!, createdAt: lead.submittedAt,
      })) });
      await tx.leadWebSource.createMany({ data: batch.map(({ id, row, submittedAt }) => ({
        leadId: id, utmSource: row.utmSource, utmMedium: row.utmMedium, utmCampaign: row.utmCampaign, utmContent: row.utmContent, utmTerm: row.utmTerm,
        pageUrl: row.pageUrl, referrer: row.referrer, submittedAt, answers: row.answers as unknown as Prisma.InputJsonValue,
      })) });
      await tx.metaLead.createMany({ data: batch.map((lead) => ({ orgId, externalId: lead.key, leadId: lead.id })) });
    }
  }
}
