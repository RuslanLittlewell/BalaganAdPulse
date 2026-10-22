import { http } from "@/shared/lib/index.js";

export const KPI_METRIC_IDS = [
  "SPEND", "IMPRESSIONS", "REACH", "CLICKS", "CONVERSIONS", "RESULTS", "REVENUE",
  "CTR", "CPC", "CPM", "CPA", "COST_PER_RESULT", "ROAS", "FREQUENCY",
] as const;

export type KpiMetric = (typeof KPI_METRIC_IDS)[number];

export const MANUAL_KPI = "MANUAL";

export const isKpiMetric = (metric: string): metric is KpiMetric =>
  (KPI_METRIC_IDS as readonly string[]).includes(metric);

export interface MeasuredKpiInput {
  metric: KpiMetric;
  target: string;
}

export interface ManualKpiInput {
  metric: typeof MANUAL_KPI;
  name: string;
  value: string;
  target: string;
}

export type KpiInput = MeasuredKpiInput | ManualKpiInput;

export type Kpi = KpiInput & { updatedAt: string };

export const MAX_PROJECT_KPIS = 5;

export type ProjectKpiInput = KpiInput & { enabled: boolean };

export type ProjectKpi = Kpi & { id: string; enabled: boolean };

export interface CarriedKpi {
  metric: string;
  target: string;
  name?: string | null;
  value?: string | null;
  enabled?: boolean;
}

export function kpiInputOf(carried: CarriedKpi | null | undefined): KpiInput | null {
  if (!carried) return null;
  if (carried.metric === MANUAL_KPI) {
    return carried.name != null && carried.value != null
      ? { metric: MANUAL_KPI, name: carried.name, value: carried.value, target: carried.target }
      : null;
  }
  return isKpiMetric(carried.metric) ? { metric: carried.metric, target: carried.target } : null;
}

export type SingleKpiScope =
  | { kind: "organization" }
  | { kind: "campaign"; id: string };

export type KpiScope = SingleKpiScope | { kind: "project"; id: string };

const pathOf = (scope: SingleKpiScope) => scope.kind === "organization"
  ? "/organization/kpi"
  : `/campaigns/${encodeURIComponent(scope.id)}/kpi`;

export const kpiApi = {
  read: (scope: SingleKpiScope) => http.get<Kpi | null>(pathOf(scope)),
  save: (scope: SingleKpiScope, body: KpiInput) => http.put<Kpi>(pathOf(scope), body),
  clear: (scope: SingleKpiScope) => http.del(pathOf(scope)),
};

const projectPathOf = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/kpis`;

export const projectKpisApi = {
  read: (projectId: string) => http.get<ProjectKpi[]>(projectPathOf(projectId)),
  save: (projectId: string, body: ProjectKpiInput[]) => http.put<ProjectKpi[]>(projectPathOf(projectId), body),
};
