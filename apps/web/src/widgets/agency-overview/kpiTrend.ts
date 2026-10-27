import { figuresOfAccount, totalPerformance, type DateRange, type ProjectFigures } from "@/entities/campaign/index.js";
import { enabledKpis, kpiResult } from "@/entities/kpi/index.js";

export function kpiTrend(figures: ProjectFigures | undefined, range: DateRange): number[] {
  const kpis = figures?.kpis ?? [];
  if (enabledKpis(kpis, false).length === 0) return [];
  const dates = (figures?.days ?? []).map((day) => day.date).sort((a, b) => a.localeCompare(b));
  return dates.flatMap((date) => {
    const result = kpiResult(
      kpis,
      (account) => totalPerformance(figuresOfAccount(figures, account).days.filter((day) => day.date <= date)),
      { from: range.from, to: date },
      false,
    );
    return result === null ? [] : [result];
  });
}
