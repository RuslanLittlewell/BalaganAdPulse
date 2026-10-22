import { formatCount } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import type { ResultType, ResultsOfType } from "../api/api.js";

export function resultTypeLabel(type: ResultType): string {
  return t(`resultType.${type}`);
}

export function mergeResultTypes(lists: readonly (readonly ResultsOfType[])[]): ResultsOfType[] {
  const totals = new Map<ResultType, number>();
  for (const list of lists) {
    for (const entry of list) totals.set(entry.type, (totals.get(entry.type) ?? 0) + entry.results);
  }
  return [...totals].map(([type, results]) => ({ type, results })).sort((a, b) => b.results - a.results);
}

export function resultTypesText(types: readonly ResultsOfType[]): string {
  return types.map((entry) => resultTypeLabel(entry.type)).join(", ");
}

export function resultsBreakdown(types: readonly ResultsOfType[]): string | undefined {
  const counted = types.filter((entry) => entry.results > 0);
  if (counted.length < 2) return undefined;
  return counted.map((entry) => `${resultTypeLabel(entry.type)}: ${formatCount(entry.results)}`).join(" · ");
}

export const RESULT_TYPE_COLUMN = { id: "resultType", label: t("resultType.column"), shown: true } as const;
