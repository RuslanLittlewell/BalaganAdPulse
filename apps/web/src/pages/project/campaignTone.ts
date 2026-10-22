import { isRunning, type Campaign, type PerformanceTone } from "@/entities/campaign/index.js";
import { isKpiMetric, kpiProgress, leastMetProgress, type CarriedKpi } from "@/entities/kpi/index.js";

const GOOD_FROM = 90;
const MIDDLE_FROM = 70;

export function campaignTone(
  campaign: Pick<Campaign, "status" | "kpi" | "performance">,
  projectKpis: readonly CarriedKpi[] | null | undefined,
  range: { from: string; to: string },
): PerformanceTone {
  if (!isRunning(campaign.status)) return "idle";
  const own = campaign.kpi && isKpiMetric(campaign.kpi.metric)
    ? { metric: campaign.kpi.metric, target: campaign.kpi.target }
    : null;
  const percent = own
    ? kpiProgress(campaign.performance, own, range).percent
    : leastMetProgress(projectKpis, campaign.performance, range, false)?.percent ?? null;
  if (percent === null) return "idle";
  if (percent >= GOOD_FROM) return "profitable";
  if (percent >= MIDDLE_FROM) return "stable";
  return "danger";
}
