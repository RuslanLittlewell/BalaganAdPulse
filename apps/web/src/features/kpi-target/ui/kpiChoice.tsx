import {
  isKpiMetric, KPI_METRICS, MANUAL_KPI, TYPED_KPI_METRICS, type KpiInput, type KpiMetric,
} from "@/entities/kpi/index.js";
import { resultTypeCostLabel, resultTypeLabel, type ResultType } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { SelectItem } from "@/shared/ui/index.js";

export type Choice = string;

export const typedChoice = (metric: KpiMetric, type: string): Choice => `${metric}:${type}`;

export function choiceOf(kpi: KpiInput): Choice {
  if (kpi.metric === MANUAL_KPI) return MANUAL_KPI;
  return kpi.resultType ? typedChoice(kpi.metric, kpi.resultType) : kpi.metric;
}

export function measuredOf(choice: Choice): { metric: KpiMetric; resultType?: string } {
  const [metric, resultType] = choice.split(":");
  const measured = isKpiMetric(metric ?? "") ? metric as KpiMetric : "CONVERSIONS";
  return resultType ? { metric: measured, resultType } : { metric: measured };
}

function typedTitle(metric: KpiMetric, type: ResultType): string {
  return metric === "RESULTS" ? resultTypeLabel(type) : resultTypeCostLabel(type);
}

export function MeasuredChoices({ resultTypes }: { resultTypes: readonly ResultType[] }) {
  return (
    <>
      {KPI_METRICS.map((definition) => (
        <SelectItem key={definition.id} value={definition.id}>{t(definition.label)}</SelectItem>
      ))}
      {resultTypes.flatMap((type) => TYPED_KPI_METRICS.map((metric) => (
        <SelectItem key={typedChoice(metric, type)} value={typedChoice(metric, type)}>
          {typedTitle(metric, type)}
        </SelectItem>
      )))}
    </>
  );
}
