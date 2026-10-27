import { kpiMetricDefinition, type KpiMetric, type MeasuredKpiInput } from "@/entities/kpi/index.js";
import { isResultType, resultTypeColumnLabel, resultTypeCostLabel } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export function measuredTitle(metric: KpiMetric, resultType?: string | null): string {
  if (isResultType(resultType)) {
    return metric === "RESULTS" ? resultTypeColumnLabel(resultType) : resultTypeCostLabel(resultType);
  }
  return t(kpiMetricDefinition(metric).label);
}

export function kpiTitle(kpi: MeasuredKpiInput): string {
  return measuredTitle(kpi.metric, kpi.resultType);
}
