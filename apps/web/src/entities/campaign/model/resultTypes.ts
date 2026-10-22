import { t } from "@/shared/config/index.js";
import { RESULT_TYPES, type Measured, type ResultType, type ResultTypeFigure } from "../api/api.js";

const ORDER = new Map<ResultType, number>(RESULT_TYPES.map((type, index) => [type, index]));

export function resultTypeLabel(type: ResultType): string {
  return t(`resultType.${type}`);
}

export function resultTypeCostLabel(type: ResultType): string {
  return `${t("resultType.cost")} · ${resultTypeLabel(type)}`;
}

export function isResultType(value: string | null | undefined): value is ResultType {
  return value != null && (RESULT_TYPES as readonly string[]).includes(value);
}

export function orderedResultTypes(types: Iterable<ResultType>): ResultType[] {
  return [...new Set(types)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

export function mergeResultTypeFigures(lists: readonly (readonly ResultTypeFigure[] | undefined)[]): ResultTypeFigure[] {
  const totals = new Map<ResultType, { results: number; spend: number }>();
  for (const list of lists) {
    for (const figure of list ?? []) {
      const running = totals.get(figure.type) ?? { results: 0, spend: 0 };
      totals.set(figure.type, { results: running.results + figure.results, spend: running.spend + figure.spend });
    }
  }
  return [...totals]
    .map(([type, total]) => ({ type, ...total }))
    .sort((a, b) => b.results - a.results || ORDER.get(a.type)! - ORDER.get(b.type)!);
}

export function typedResults(figures: Pick<Measured, "resultTypes">, type: ResultType): number | null {
  return figures.resultTypes?.find((figure) => figure.type === type)?.results ?? null;
}

export function hasMixedResults(figures: readonly ResultTypeFigure[] | undefined): boolean {
  return (figures ?? []).filter((figure) => figure.results > 0).length > 1;
}

export function resultTypeColumnLabel(type: ResultType): string {
  return `${t("metric.results")} - ${resultTypeLabel(type)}`;
}

export const resultsColumnId = (type: ResultType) => `results.${type}`;

export function resultTypeFiguresOf(
  figures: Pick<Measured, "resultTypes">,
  types: readonly ResultType[],
): Record<string, number | null> {
  return Object.fromEntries(types.map((type) => [resultsColumnId(type), typedResults(figures, type)]));
}
