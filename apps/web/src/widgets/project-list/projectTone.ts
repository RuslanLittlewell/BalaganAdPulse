import { figuresOfAccount, type DateRange, type ProjectFigures } from "@/entities/campaign/index.js";
import { kpiResult } from "@/entities/kpi/index.js";

export type ProjectTone = "none" | "danger" | "behind" | "met";

const MET_FROM = 90;
const BEHIND_FROM = 70;

export function projectKpiPercent(figures: ProjectFigures | undefined, range: DateRange): number | null {
  const result = kpiResult(figures?.kpis, (account) => figuresOfAccount(figures, account).performance, range);
  return result === null ? null : Math.round(result);
}

export function toneOfPercent(percent: number | null): ProjectTone {
  if (percent === null) return "none";
  if (percent >= MET_FROM) return "met";
  if (percent >= BEHIND_FROM) return "behind";
  return "danger";
}

export function projectTone(figures: ProjectFigures | undefined, range: DateRange): ProjectTone {
  return toneOfPercent(projectKpiPercent(figures, range));
}
