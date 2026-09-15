import { http } from "@/shared/lib/index.js";

export const LEAD_STAGES = ["NEW", "QUALIFIED", "TARGET", "PROPOSAL"] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const COLUMN_NAME_LIMIT = 50;

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

export interface LeadColumn {
  id: string;
  kind: "FIXED" | "CUSTOM";
  name: string;
  position: number;
}

export type ProjectStageCounts = { projectId: string } & Record<LeadStage, number>;

export interface CountingPeriod {
  from: string;
  to: string;
}

export interface LeadColumnInput {
  name?: string;
  position?: number;
}

export const AGENCY_BOARD = "agency";

export interface BoardCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface LeadBoard {
  key: string;
  label: string;
  capabilities: BoardCapabilities;
}

export type LeadOrigin = "MANUAL" | "META";

export interface LeadAnswer {
  question: string;
  values: string[];
}

export interface MetaEntityName {
  externalId: string;
  name: string;
}

export interface LeadMetaSource {
  accountId: string;
  formId: string;
  campaign: MetaEntityName;
  adSet: MetaEntityName;
  ad: MetaEntityName;
  submittedAt: string;
  answers: LeadAnswer[];
  answersOmitted: boolean;
}

export interface LeadAd {
  id: string;
  name: string;
  externalId: string | null;
}

export interface LeadProject {
  id: string;
  clientId: string;
  name: string;
}

export interface LeadAssignee {
  id: string;
  name: string;
  image: string | null;
}

export interface Lead {
  id: string;
  orgId: string;
  clientId: string | null;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: string | null;
  notes: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  name?: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  notes?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
  assigneeId?: string | null;
  stage?: string;
}

export interface LeadMove {
  stage: string;
  position: number;
}

const board = (boardKey: string) => `/crm/boards/${encodeURIComponent(boardKey)}`;

export const leadsApi = {
  boards: () => http.get<LeadBoard[]>("/crm/boards"),
  list: (boardKey: string) => http.get<Lead[]>(`${board(boardKey)}/leads`),
  read: (boardKey: string, id: string) => http.get<Lead>(`${board(boardKey)}/leads/${id}`),
  create: (boardKey: string, body: LeadInput) => http.post<Lead>(`${board(boardKey)}/leads`, body),
  update: (boardKey: string, id: string, body: LeadInput) =>
    http.patch<Lead>(`${board(boardKey)}/leads/${id}`, body),
  remove: (boardKey: string, id: string) => http.del(`${board(boardKey)}/leads/${id}`),
  move: (boardKey: string, id: string, body: LeadMove) =>
    http.patch<Lead[]>(`${board(boardKey)}/leads/${id}/move`, body),
  projectStageCounts: ({ from, to }: CountingPeriod) =>
    http.get<ProjectStageCounts[]>(`/crm/project-stage-counts?from=${from}&to=${to}`),
  columns: (boardKey: string) => http.get<LeadColumn[]>(`${board(boardKey)}/columns`),
  createColumn: (boardKey: string, name: string) =>
    http.post<LeadColumn>(`${board(boardKey)}/columns`, { name }),
  updateColumn: (boardKey: string, id: string, body: LeadColumnInput) =>
    http.patch<LeadColumn[]>(`${board(boardKey)}/columns/${id}`, body),
  removeColumn: (boardKey: string, id: string) => http.del(`${board(boardKey)}/columns/${id}`),
};
