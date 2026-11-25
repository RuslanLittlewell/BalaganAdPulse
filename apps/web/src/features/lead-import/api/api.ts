import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export interface ImportTable {
  columns: string[];
  rows: string[][];
}

export interface ImportRow {
  name: string | null;
  phone: string | null;
  email: string | null;
  submittedAt: string | null;
  campaign: string | null;
  status: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  pageUrl: string | null;
  referrer: string | null;
  answers: Array<{ question: string; values: string[] }>;
}

export interface ImportSkips {
  onBoard: number;
  repeated: number;
  empty: number;
}

export interface ImportPreview {
  added: number;
  skipped: ImportSkips;
  undated: number;
  campaigns: Array<{ value: string | null; leads: number; campaign: { id: string; name: string } | null }>;
  statuses: Array<{ value: string; leads: number; column: { id: string; name: string } | null }>;
}

export interface ImportPlacement {
  value: string;
  columnId: string;
}

export interface ImportChoice {
  value: string | null;
  campaignId: string | null;
}

export interface ImportOutcome {
  added: number;
  skipped: ImportSkips;
}

export type ImportSource = { csv: string } | { url: string };

const importsPath = (boardKey: string) => `/crm/boards/${encodeURIComponent(boardKey)}/imports`;

export function useLeadImport(boardKey: string) {
  const client = useQueryClient();
  return {
    table: useMutation({ mutationFn: (source: ImportSource) => http.post<ImportTable>(`${importsPath(boardKey)}/table`, source) }),
    preview: useMutation({ mutationFn: (rows: ImportRow[]) => http.post<ImportPreview>(`${importsPath(boardKey)}/preview`, { rows }) }),
    run: useMutation({
      mutationFn: (input: { rows: ImportRow[]; choices: ImportChoice[]; placements: ImportPlacement[] }) => http.post<ImportOutcome>(importsPath(boardKey), input),
      onSuccess: () => client.invalidateQueries({ queryKey: ["crm"] }),
    }),
  };
}
