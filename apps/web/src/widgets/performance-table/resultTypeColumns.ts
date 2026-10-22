import {
  costColumnId,
  RESULT_TYPE_COLUMN,
  resultsColumnId,
  resultTypeCostLabel,
  resultTypeLabel,
  type ResultType,
} from "@/entities/campaign/index.js";
import { formatCount, formatRatio } from "@/shared/lib/index.js";
import type { ExtraColumn } from "./PerformanceTable.js";

export function resultTypeColumns(types: readonly ResultType[]): ExtraColumn[] {
  return [
    RESULT_TYPE_COLUMN,
    ...types.flatMap((type) => [
      { id: resultsColumnId(type), label: resultTypeLabel(type), format: (value: number) => formatCount(value), shown: true },
      { id: costColumnId(type), label: resultTypeCostLabel(type), format: formatRatio, shown: true },
    ]),
  ];
}
