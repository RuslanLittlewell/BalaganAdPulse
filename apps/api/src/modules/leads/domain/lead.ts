export const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DEFERRED'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export const LEAD_ORIGINS = ['MANUAL', 'META'] as const;
export type LeadOrigin = typeof LEAD_ORIGINS[number];
export interface LeadFields {
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  notes?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
}
export interface LeadAnswer { question: string; values: string[] }
export interface MetaEntityName { externalId: string; name: string }
export interface LeadMetaSource {
  accountId: string;
  formId: string;
  campaign: MetaEntityName;
  adSet: MetaEntityName;
  ad: MetaEntityName;
  submittedAt: Date;
  answers: LeadAnswer[];
  answersOmitted: boolean;
}
export interface LeadAd { id: string; name: string; externalId: string | null }
export interface LeadRecord extends LeadFields {
  id: string;
  orgId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
  adId: string | null;
  origin: LeadOrigin;
  ad: LeadAd | null;
  metaSource: LeadMetaSource | null;
  stage: LeadStage;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface LeadBoard { key: string; label: string }
