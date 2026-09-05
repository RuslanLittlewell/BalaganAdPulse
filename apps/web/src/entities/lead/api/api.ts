import { http } from "@/shared/lib/index.js";

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "DEFERRED",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

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
  stage: LeadStage;
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
  stage?: LeadStage;
}

export interface LeadMove {
  stage: LeadStage;
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
};
