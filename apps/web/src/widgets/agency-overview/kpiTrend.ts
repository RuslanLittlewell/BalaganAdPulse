import type { DateRange, ProjectFigures } from "@/entities/campaign/index.js";
import { totalPerformance } from "@/entities/campaign/index.js";
import { enabledKpis, kpiProgress, MANUAL_KPI } from "@/entities/kpi/index.js";

export function kpiTrend(
  kpis: ProjectFigures["kpis"] | undefined,
  days: ProjectFigures["days"],
  range: DateRange,
): number[] {
  const measured = enabledKpis(kpis).filter((kpi) => kpi.metric !== MANUAL_KPI);
  if (measured.length === 0) return [];
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return ordered.flatMap((day, index) => {
    const figures = totalPerformance(ordered.slice(0, index + 1));
    const percents = measured
      .map((kpi) => kpiProgress(figures, kpi, { from: range.from, to: day.date }).percent)
      .filter((percent): percent is number => percent !== null && Number.isFinite(percent));
    return percents.length > 0 ? [Math.min(...percents)] : [];
  });
}
