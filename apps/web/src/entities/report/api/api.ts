import { http } from "@/shared/lib/index.js";

export type ReportStatus = "DRAFT" | "PUBLISHED";

export interface MonthFigures {
  month: string;
  spend: string;
  leads: number;
  costPerLead: string | null;
}

export interface AdFigures {
  adId: string;
  name: string;
  spend: string;
  leads: number;
  costPerLead: string | null;
}

export interface ReportSummary {
  id: string;
  projectId: string;
  month: string;
  status: ReportStatus;
  currency: string | null;
  spend: string;
  leads: number;
  costPerLead: string | null;
  publishedAt: string | null;
}

export interface ReportList {
  reports: ReportSummary[];
  available: string[];
}

export interface Report {
  id: string;
  projectId: string;
  month: string;
  status: ReportStatus;
  currency: string | null;
  spend: string;
  leads: number;
  costPerLead: string | null;
  previous: MonthFigures | null;
  change: { leads: string | null; costPerLead: string | null };
  trend: MonthFigures[];
  ads: AdFigures[];
  messengerContacts: number | null;
  hasCover: boolean;
  conclusions: unknown | null;
  plan: unknown | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  computedAt?: string;
  computedLeads?: number;
  leadsOverride?: number | null;
  runningAds?: AdFigures[];
}

export interface ReportEdit {
  leadsOverride?: number | null;
  messengerContacts?: number | null;
  conclusions?: unknown | null;
  plan?: unknown | null;
  adIds?: string[];
}

const base = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/reports`;
const one = (projectId: string, id: string) => `${base(projectId)}/${encodeURIComponent(id)}`;

export const reportsApi = {
  listAll: (projectId?: string) =>
    http.get<ReportSummary[]>(projectId ? `/reports?projectId=${encodeURIComponent(projectId)}` : "/reports"),
  read: (id: string) => http.get<Report>(`/reports/${encodeURIComponent(id)}`),
  list: (projectId: string) => http.get<ReportList>(base(projectId)),
  generate: (projectId: string, month: string) => http.post<Report>(base(projectId), { month }),
  edit: (projectId: string, id: string, edit: ReportEdit) => http.patch<Report>(one(projectId, id), edit),
  refresh: (projectId: string, id: string) => http.post<Report>(`${one(projectId, id)}/refresh`, {}),
  publish: (projectId: string, id: string) => http.post<Report>(`${one(projectId, id)}/publish`, {}),
  unpublish: (projectId: string, id: string) => http.post<Report>(`${one(projectId, id)}/unpublish`, {}),
  remove: (projectId: string, id: string) => http.del(one(projectId, id)),
  uploadCover: (projectId: string, id: string, image: Blob) => {
    const form = new FormData();
    form.append("image", image);
    return http.putForm<Report>(`${one(projectId, id)}/cover`, form);
  },
  removeCover: (projectId: string, id: string) => http.del(`${one(projectId, id)}/cover`),
  cover: async (projectId: string, id: string) =>
    URL.createObjectURL(await http.getBlob(`${one(projectId, id)}/cover`)),
};
