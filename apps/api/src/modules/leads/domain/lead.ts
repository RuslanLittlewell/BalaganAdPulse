import type { CustomValues, OptionColor } from './lead-field.js';
import type { CompanySummary, PersonSummary } from './crm-record.js';
export const LEAD_STAGES = ['NEW', 'QUALIFIED', 'TARGET', 'PROPOSAL'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export const LEAD_STAGE_NAMES: Record<LeadStage, string> = { NEW: 'Новый', QUALIFIED: 'Квалифицированный', TARGET: 'Целевой', PROPOSAL: 'КП' };
export const COLUMN_NAME_LIMIT = 50;
export const FIXED_STAGE_COLORS: Record<LeadStage, OptionColor> = { NEW: 'blue', QUALIFIED: 'purple', TARGET: 'orange', PROPOSAL: 'green' };
export const DEFAULT_COLUMN_COLOR: OptionColor = 'gray';
export const CUSTOM_COLUMN_LIMIT = 20;
export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}
export function placementOf(stage: string): { stage: LeadStage; columnId: null } | { stage: null; columnId: string } {
  return isLeadStage(stage) ? { stage, columnId: null } : { stage: null, columnId: stage };
}
export type StageCounts = Record<LeadStage, number>;
export type ProjectStageCounts = { projectId: string } & StageCounts;
export interface BoardStageCounts {
  campaigns: ({ campaignId: string } & StageCounts)[];
  adSets: ({ adSetId: string } & StageCounts)[];
  ads: ({ adId: string } & StageCounts)[];
}
export interface StageGroup { campaignId: string | null; adId: string | null; stage: LeadStage; count: number }
export function emptyStageCounts(): StageCounts {
  return Object.fromEntries(LEAD_STAGES.map(stage => [stage, 0])) as StageCounts;
}
function tally(groups: readonly StageGroup[], keyOf: (group: StageGroup) => string | null | undefined): [string, StageCounts][] {
  const rows = new Map<string, StageCounts>();
  for (const group of groups) {
    const key = keyOf(group);
    if (key == null) continue;
    const row = rows.get(key) ?? emptyStageCounts();
    row[group.stage] += group.count;
    rows.set(key, row);
  }
  return [...rows].sort(([a], [b]) => a.localeCompare(b));
}
export function foldBoardStageCounts(groups: readonly StageGroup[], adSetOf: ReadonlyMap<string, string>): BoardStageCounts {
  return {
    campaigns: tally(groups, group => group.campaignId).map(([campaignId, counts]) => ({ campaignId, ...counts })),
    adSets: tally(groups, group => group.adId && adSetOf.get(group.adId)).map(([adSetId, counts]) => ({ adSetId, ...counts })),
    ads: tally(groups, group => group.adId).map(([adId, counts]) => ({ adId, ...counts })),
  };
}
export interface ArrivalWindow { start: Date; end: Date }
export function arrivalWindow(from: Date, to: Date): ArrivalWindow {
  return { start: from, end: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
}
export interface LeadColumnRecord {
  id: string;
  orgId: string;
  projectId: string;
  clientId: string;
  name: string;
  afterStage: LeadStage | null;
  position: number;
  color: OptionColor;
  createdAt: Date;
  updatedAt: Date;
}
export type BoardColumn =
  | { id: LeadStage; kind: 'FIXED'; name: string; position: number; color: OptionColor }
  | { id: string; kind: 'CUSTOM'; name: string; position: number; color: OptionColor };
export function customColumnOf({ id, name, position, color }: LeadColumnRecord): BoardColumn {
  return { id, kind: 'CUSTOM', name, position, color };
}
export function boardColumns(custom: readonly LeadColumnRecord[]): BoardColumn[] {
  const after = (stage: LeadStage | null) =>
    custom.filter(column => column.afterStage === stage).sort((a, b) => a.position - b.position).map(customColumnOf);
  return [
    ...after(null),
    ...LEAD_STAGES.flatMap((stage, position) => [
      { id: stage, kind: 'FIXED' as const, name: LEAD_STAGE_NAMES[stage], position, color: FIXED_STAGE_COLORS[stage] },
      ...after(stage),
    ]),
  ];
}
export const LEAD_ORIGINS = ['MANUAL', 'META'] as const;
export type LeadOrigin = typeof LEAD_ORIGINS[number];
export const TAG_LIMIT = 10;
export const TAG_LENGTH_LIMIT = 30;
export interface LeadFields {
  name: string;
  personId?: string | null;
  companyId?: string | null;
  source?: string | null;
  notes?: string | null;
  amount?: string | null;
  service?: string | null;
  tags?: string[];
  campaignId?: string | null;
  assigneeId?: string | null;
  customValues?: CustomValues;
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
  projectId: string;
  campaignId: string | null;
  assigneeId: string | null;
  personId: string | null;
  companyId: string | null;
  person: PersonSummary | null;
  company: CompanySummary | null;
  adId: string | null;
  amount: string | null;
  tags: string[];
  customValues: CustomValues;
  origin: LeadOrigin;
  ad: LeadAd | null;
  project: LeadProject;
  assignee: LeadAssignee | null;
  metaSource: LeadMetaSource | null;
  stage: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface LeadBoard { key: string; label: string; clientId: string; clientName: string }
