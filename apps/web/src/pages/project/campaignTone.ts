import { isRunning, type Campaign, type PerformanceTone } from "@/entities/campaign/index.js";
import { kpiInputOf, kpiProgress, leastMetProgress, type CarriedKpi } from "@/entities/kpi/index.js";

const GOOD_FROM = 90;
const MIDDLE_FROM = 70;

function ownTypes(
  kpis: readonly CarriedKpi[] | null | undefined,
  types: readonly string[],
): CarriedKpi[] {
  return (kpis ?? []).filter((kpi) => !kpi.resultType || types.includes(kpi.resultType));
}

export function campaignTone(
  campaign: Pick<Campaign, "status" | "kpi" | "performance" | "resultTypes">,
  projectKpis: readonly CarriedKpi[] | null | undefined,
  range: { from: string; to: string },
): PerformanceTone {
  if (!isRunning(campaign.status)) return "idle";
  const own = kpiInputOf(campaign.kpi);
  const percent = own
    ? kpiProgress(campaign.performance, own, range).percent
    : leastMetProgress(ownTypes(projectKpis, campaign.resultTypes), campaign.performance, range, false)?.percent ?? null;
  if (percent === null) return "idle";
  if (percent >= GOOD_FROM) return "profitable";
  if (percent >= MIDDLE_FROM) return "stable";
  return "danger";
}
