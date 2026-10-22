import { kpiMetricDefinition, type MeasuredKpiInput } from "@/entities/kpi/index.js";
import { isResultType, resultTypeCostLabel, resultTypeLabel } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export function kpiTitle(kpi: MeasuredKpiInput): string {
  if (isResultType(kpi.resultType)) {
    return kpi.metric === "RESULTS" ? resultTypeLabel(kpi.resultType) : resultTypeCostLabel(kpi.resultType);
  }
  return t(kpiMetricDefinition(kpi.metric).label);
}
