import { resultsColumnId, resultTypeColumnLabel, type ResultType } from "@/entities/campaign/index.js";
import { formatCount } from "@/shared/lib/index.js";
import type { ExtraColumn } from "./PerformanceTable.js";

export function resultTypeColumns(types: readonly ResultType[]): ExtraColumn[] {
  return types.map((type) => ({
    id: resultsColumnId(type),
    label: resultTypeColumnLabel(type),
    format: (value: number) => formatCount(value),
    shown: true,
  }));
}
