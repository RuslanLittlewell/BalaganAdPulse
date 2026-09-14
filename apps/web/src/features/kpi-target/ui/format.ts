import type { KpiFormat } from "@/entities/kpi/index.js";
import {
  formatCount, formatCurrency, formatMultiple, formatPercent, formatRatio, type Currency,
} from "@/shared/lib/index.js";

export function formatKpiValue(format: KpiFormat, value: number | null, currency: Currency): string {
  switch (format) {
    case "currency": return formatCurrency(value, currency);
    case "count": return formatCount(value);
    case "percent": return formatPercent(value);
    case "ratio": return formatRatio(value, currency);
    case "multiple": return formatMultiple(value);
  }
}
