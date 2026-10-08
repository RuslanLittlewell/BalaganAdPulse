import { isRunning, type Campaign, type PerformanceTone } from "@/entities/campaign/index.js";
import { KPI_METRIC_IDS, kpiProgress, type KpiInput, type KpiMetric } from "@/entities/kpi/index.js";

const GOOD_FROM = 100;
const MIDDLE_FROM = 80;

const isMetric = (metric: string): metric is KpiMetric =>
  (KPI_METRIC_IDS as readonly string[]).includes(metric);

export function campaignTone(
  campaign: Pick<Campaign, "status" | "kpi" | "performance">,
  projectKpi: KpiInput | null | undefined,
  range: { from: string; to: string },
): PerformanceTone {
  if (!isRunning(campaign.status)) return "idle";
  const own = campaign.kpi && isMetric(campaign.kpi.metric)
    ? { metric: campaign.kpi.metric, target: campaign.kpi.target }
    : null;
  const kpi = own ?? projectKpi ?? null;
  if (!kpi) return "idle";
  const { percent } = kpiProgress(campaign.performance, kpi, range);
  if (percent === null) return "idle";
  if (percent >= GOOD_FROM) return "profitable";
  if (percent >= MIDDLE_FROM) return "stable";
  return "danger";
}
