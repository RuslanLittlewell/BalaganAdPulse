import type { DateRange, Performance, ProjectFigures } from "@/entities/campaign/index.js";
import { leastMetProgress } from "@/entities/kpi/index.js";

export type ProjectTone = "none" | "danger" | "behind" | "met";

const MET_FROM = 90;
const BEHIND_FROM = 70;

export function projectKpiPercent(
  kpis: ProjectFigures["kpis"] | undefined,
  performance: Performance,
  range: DateRange,
): number | null {
  const percent = leastMetProgress(kpis, performance, range)?.percent;
  return percent == null ? null : Math.round(percent);
}

export function toneOfPercent(percent: number | null): ProjectTone {
  if (percent === null) return "none";
  if (percent >= MET_FROM) return "met";
  if (percent >= BEHIND_FROM) return "behind";
  return "danger";
}

export function projectTone(
  kpis: ProjectFigures["kpis"] | undefined,
  performance: Performance,
  range: DateRange,
): ProjectTone {
  return toneOfPercent(projectKpiPercent(kpis, performance, range));
}
