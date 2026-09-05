export const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DEFERRED'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
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
export interface LeadRecord extends LeadFields {
  id: string;
  orgId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
  stage: LeadStage;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface LeadBoard { key: string; label: string }
