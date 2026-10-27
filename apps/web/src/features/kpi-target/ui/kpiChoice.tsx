import {
  isKpiMetric, KPI_METRICS, MANUAL_KPI, TYPED_KPI_METRICS, type KpiInput, type KpiMetric,
} from "@/entities/kpi/index.js";
import type { ResultType } from "@/entities/campaign/index.js";
import { SelectItem } from "@/shared/ui/index.js";
import { measuredTitle } from "./kpiTitle.js";

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

function measuredOptions(resultTypes: readonly ResultType[]): { choice: Choice; title: string }[] {
  return [
    ...KPI_METRICS.map(({ id }) => ({ choice: id, title: measuredTitle(id) })),
    ...resultTypes.flatMap((type) => TYPED_KPI_METRICS.map((metric) => ({
      choice: typedChoice(metric, type), title: measuredTitle(metric, type),
    }))),
  ].sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export function MeasuredChoices({ resultTypes }: { resultTypes: readonly ResultType[] }) {
  return (
    <>
      {measuredOptions(resultTypes).map(({ choice, title }) => (
        <SelectItem key={choice} value={choice}>{title}</SelectItem>
      ))}
    </>
  );
}
