import { sameAccount, type KpiAccount, type ProjectKpi } from "@/entities/kpi/index.js";

export type ProjectKpiPart =
  | { kind: "account"; account: KpiAccount }
  | { kind: "all"; account: KpiAccount | null };

export function partHolds(part: ProjectKpiPart, kpi: ProjectKpi): boolean {
  return part.kind === "all" || kpi.account === null || sameAccount(kpi.account, part.account);
}

export const isWholeProject = (part: ProjectKpiPart, kpi: ProjectKpi | null) =>
  part.kind === "account" && kpi !== null && kpi.account === null;
