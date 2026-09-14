import type { IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { LeadMetaSource } from '../domain/lead.js';
import type { LeadEvent } from './ports.js';

export interface IncomingLead {
  externalId: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: LeadMetaSource;
}
export interface LeadTarget { orgId: string; clientId: string; projectId: string }
export interface LeadDelivery extends LeadTarget { leads: readonly IncomingLead[] }
export interface ImportedLeadInput extends IncomingLead, LeadTarget {
  id: string;
  position: number;
  campaignId: string | null;
  adId: string | null;
}
export interface LeadIntakeRepository {
  lockBoard(context: TransactionContext, orgId: string, board: string): Promise<void>;
  claim(context: TransactionContext, orgId: string, externalId: string): Promise<boolean>;
  countNew(context: TransactionContext, orgId: string, clientId: string): Promise<number>;
  attribution(context: TransactionContext, projectId: string, source: LeadMetaSource): Promise<{ campaignId: string | null; adId: string | null }>;
  createImported(context: TransactionContext, input: ImportedLeadInput): Promise<void>;
  linkAttribution(context: TransactionContext, projectId: string): Promise<Array<{ orgId: string; clientId: string }>>;
}

export function createLeadIntake(d: { intake: LeadIntakeRepository; ids: IdGenerator; unitOfWork: UnitOfWork; publish: (event: LeadEvent) => void }) {
  const announce = ({ orgId, clientId }: { orgId: string; clientId: string }) => {
    d.publish({ kind: 'crm.changed', orgId, board: clientId });
  };
  return {
    async deliver(context: TransactionContext, delivery: LeadDelivery): Promise<{ created: number }> {
      const { orgId, clientId, projectId } = delivery;
      await d.intake.lockBoard(context, orgId, clientId);
      let position = await d.intake.countNew(context, orgId, clientId);
      let created = 0;
      for (const lead of delivery.leads) {
        if (!await d.intake.claim(context, orgId, lead.externalId)) continue;
        const attribution = await d.intake.attribution(context, projectId, lead.source);
        await d.intake.createImported(context, { ...lead, ...attribution, orgId, clientId, projectId, id: d.ids.generate(), position: position++ });
        created++;
      }
      return { created };
    },
    announce,
    async link(projectId: string): Promise<void> {
      const boards = await d.unitOfWork.run((context) => d.intake.linkAttribution(context, projectId));
      for (const board of boards) announce(board);
    },
  };
}
export type LeadIntake = ReturnType<typeof createLeadIntake>;
