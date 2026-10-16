import { isRunning, type Campaign, type PerformanceTone } from "@/entities/campaign/index.js";
import { isKpiMetric, kpiProgress, MANUAL_KPI, type KpiInput } from "@/entities/kpi/index.js";

const GOOD_FROM = 100;
const MIDDLE_FROM = 80;

export function campaignTone(
  campaign: Pick<Campaign, "status" | "kpi" | "performance">,
  projectKpi: KpiInput | null | undefined,
  range: { from: string; to: string },
): PerformanceTone {
  if (!isRunning(campaign.status)) return "idle";
  const own = campaign.kpi && isKpiMetric(campaign.kpi.metric)
    ? { metric: campaign.kpi.metric, target: campaign.kpi.target }
    : null;
  const standIn = projectKpi?.metric === MANUAL_KPI ? null : projectKpi;
  const kpi = own ?? standIn ?? null;
  if (!kpi) return "idle";
  const { percent } = kpiProgress(campaign.performance, kpi, range);
  if (percent === null) return "idle";
  if (percent >= GOOD_FROM) return "profitable";
  if (percent >= MIDDLE_FROM) return "stable";
  return "danger";
}
