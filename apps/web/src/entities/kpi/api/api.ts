import { http } from "@/shared/lib/index.js";

export const KPI_METRIC_IDS = [
  "SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "REVENUE",
  "CTR", "CPC", "CPM", "CPA", "ROAS", "FREQUENCY",
] as const;

export type KpiMetric = (typeof KPI_METRIC_IDS)[number];

export interface KpiInput {
  metric: KpiMetric;
  target: string;
}

export interface Kpi extends KpiInput {
  updatedAt: string;
}

export type KpiScope =
  | { kind: "organization" }
  | { kind: "project"; id: string }
  | { kind: "campaign"; id: string };

const pathOf = (scope: KpiScope) => scope.kind === "organization"
  ? "/organization/kpi"
  : `/${scope.kind === "project" ? "projects" : "campaigns"}/${encodeURIComponent(scope.id)}/kpi`;

export const kpiApi = {
  read: (scope: KpiScope) => http.get<Kpi | null>(pathOf(scope)),
  save: (scope: KpiScope, body: KpiInput) => http.put<Kpi>(pathOf(scope), body),
  clear: (scope: KpiScope) => http.del(pathOf(scope)),
};
