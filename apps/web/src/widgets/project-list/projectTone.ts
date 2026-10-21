import type { DateRange, Performance, ProjectFigures } from "@/entities/campaign/index.js";
import { kpiInputOf, kpiProgress } from "@/entities/kpi/index.js";

export type ProjectTone = "none" | "danger" | "behind" | "met";

const MET_FROM = 90;
const BEHIND_FROM = 70;

export function projectTone(
  kpi: ProjectFigures["kpi"] | undefined,
  performance: Performance,
  range: DateRange,
): ProjectTone {
  const goal = kpiInputOf(kpi);
  if (!goal) return "none";
  const { percent } = kpiProgress(performance, goal, range);
  if (percent === null) return "none";
  const shown = Math.round(percent);
  if (shown >= MET_FROM) return "met";
  if (shown >= BEHIND_FROM) return "behind";
  return "danger";
}
