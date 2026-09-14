import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { ImportedLeadInput, LeadIntakeRepository } from '../application/lead-intake.js';
import type { LeadMetaSource } from '../domain/lead.js';

export class PrismaLeadIntakeRepository implements LeadIntakeRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  private tx(context: TransactionContext) {
    return this.uow.clientFor<Prisma.TransactionClient>(context);
  }
  async lockBoard(context: TransactionContext, orgId: string, board: string) {
    await this.tx(context).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgId + ':' + board}, 0))`;
  }
  async claim(context: TransactionContext, orgId: string, externalId: string) {
    const inserted = await this.tx(context).$executeRaw`INSERT INTO meta_lead (org_id, external_id) VALUES (${orgId}, ${externalId}) ON CONFLICT DO NOTHING`;
    return inserted === 1;
  }
  countNew(context: TransactionContext, orgId: string, clientId: string) {
    return this.tx(context).lead.count({ where: { orgId, clientId, stage: 'NEW' } });
  }
  async attribution(context: TransactionContext, projectId: string, source: LeadMetaSource) {
    const tx = this.tx(context);
    const campaign = await tx.campaign.findFirst({ where: { projectId, channel: 'META', externalId: source.campaign.externalId }, select: { id: true } });
    const ad = await tx.ad.findFirst({ where: { externalId: source.ad.externalId, adSet: { campaign: { projectId, channel: 'META' } } }, select: { id: true } });
    return { campaignId: campaign?.id ?? null, adId: ad?.id ?? null };
  }
  async createImported(context: TransactionContext, input: ImportedLeadInput) {
    const tx = this.tx(context);
    const { source } = input;
    await tx.lead.create({ data: {
      id: input.id, orgId: input.orgId, clientId: input.clientId, projectId: input.projectId,
      campaignId: input.campaignId, adId: input.adId, origin: 'META', stage: 'NEW', position: input.position,
      name: input.name, company: input.company, phone: input.phone, email: input.email,
      metaSource: { create: {
        accountId: source.accountId, formId: source.formId,
        campaignExternalId: source.campaign.externalId, campaignName: source.campaign.name,
        adSetExternalId: source.adSet.externalId, adSetName: source.adSet.name,
        adExternalId: source.ad.externalId, adName: source.ad.name,
        submittedAt: source.submittedAt, answers: source.answers as unknown as Prisma.InputJsonValue, answersOmitted: source.answersOmitted,
      } },
    } });
    await tx.metaLead.update({ where: { orgId_externalId: { orgId: input.orgId, externalId: input.externalId } }, data: { leadId: input.id } });
  }
  async linkAttribution(context: TransactionContext, projectId: string) {
    const tx = this.tx(context);
    const campaigns = await tx.$queryRaw<Array<{ org_id: string; client_id: string }>>`
      UPDATE lead SET campaign_id = campaign.id, updated_at = now()
      FROM lead_meta_source source, campaign
      WHERE source.lead_id = lead.id AND lead.project_id = ${projectId} AND lead.origin = 'META' AND lead.campaign_id IS NULL
        AND campaign.project_id = ${projectId} AND campaign.channel = 'META' AND campaign.external_id = source.campaign_external_id
      RETURNING lead.org_id, lead.client_id`;
    const ads = await tx.$queryRaw<Array<{ org_id: string; client_id: string }>>`
      UPDATE lead SET ad_id = ad.id, updated_at = now()
      FROM lead_meta_source source, ad, ad_set, campaign
      WHERE source.lead_id = lead.id AND lead.project_id = ${projectId} AND lead.origin = 'META' AND lead.ad_id IS NULL
        AND ad.external_id = source.ad_external_id AND ad.ad_set_id = ad_set.id AND ad_set.campaign_id = campaign.id
        AND campaign.project_id = ${projectId} AND campaign.channel = 'META'
      RETURNING lead.org_id, lead.client_id`;
    const boards = new Map<string, { orgId: string; clientId: string }>();
    for (const row of [...campaigns, ...ads]) boards.set(`${row.org_id}:${row.client_id}`, { orgId: row.org_id, clientId: row.client_id });
    return [...boards.values()];
  }
}
