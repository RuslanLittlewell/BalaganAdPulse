export const LEAD_STAGES = ['NEW', 'QUALIFIED', 'TARGET', 'PROPOSAL'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export const LEAD_STAGE_NAMES: Record<LeadStage, string> = { NEW: 'Новый', QUALIFIED: 'Квалифицированный', TARGET: 'Целевой', PROPOSAL: 'КП' };
export const COLUMN_NAME_LIMIT = 50;
export const CUSTOM_COLUMN_LIMIT = 20;
export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}
export function placementOf(stage: string): { stage: LeadStage; columnId: null } | { stage: null; columnId: string } {
  return isLeadStage(stage) ? { stage, columnId: null } : { stage: null, columnId: stage };
}
export type ProjectStageCounts = { projectId: string } & Record<LeadStage, number>;
export interface ArrivalWindow { start: Date; end: Date }
export function arrivalWindow(from: Date, to: Date): ArrivalWindow {
  return { start: from, end: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
}
export interface LeadColumnRecord {
  id: string;
  orgId: string;
  clientId: string | null;
  name: string;
  afterStage: LeadStage | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
export type BoardColumn =
  | { id: LeadStage; kind: 'FIXED'; name: string; position: number }
  | { id: string; kind: 'CUSTOM'; name: string; position: number };
export function customColumnOf({ id, name, position }: LeadColumnRecord): BoardColumn {
  return { id, kind: 'CUSTOM', name, position };
}
export function boardColumns(custom: readonly LeadColumnRecord[]): BoardColumn[] {
  const after = (stage: LeadStage | null) =>
    custom.filter(column => column.afterStage === stage).sort((a, b) => a.position - b.position).map(customColumnOf);
  return [
    ...after(null),
    ...LEAD_STAGES.flatMap((stage, position) => [
      { id: stage, kind: 'FIXED' as const, name: LEAD_STAGE_NAMES[stage], position },
      ...after(stage),
    ]),
  ];
}
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
  assigneeId?: string | null;
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
export interface LeadProject { id: string; clientId: string; name: string }
export interface LeadAssignee { id: string; name: string; image: string | null }
export interface LeadRecord extends LeadFields {
  id: string;
  orgId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
  assigneeId: string | null;
  adId: string | null;
  origin: LeadOrigin;
  ad: LeadAd | null;
  project: LeadProject | null;
  assignee: LeadAssignee | null;
  metaSource: LeadMetaSource | null;
  stage: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface LeadBoard { key: string; label: string }
