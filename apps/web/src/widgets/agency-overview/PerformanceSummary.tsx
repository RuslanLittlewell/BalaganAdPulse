import { MetricCard } from "@/shared/ui/index.js";
import {
  formatCount, formatCurrency, formatMultiple, formatPercent, formatRatio,
} from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import { EMPTY_PERFORMANCE, type Performance } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export function PerformanceSummary({
  performance,
  currency = "RUB",
}: {
  performance?: Performance;
  currency?: Currency;
}) {
  const figures = performance ?? EMPTY_PERFORMANCE;

  const cards = [
    { label: t("metric.spend"), value: formatCurrency(figures.spend, currency),
      hint: `${t("metric.cpm")} ${formatRatio(figures.cpm, currency)}` },
    { label: t("metric.impressions"), value: formatCount(figures.impressions),
      hint: `${t("metric.frequency")} ${formatMultiple(figures.frequency)}` },
    { label: t("metric.clicks"), value: formatCount(figures.clicks),
      hint: `${t("metric.ctr")} ${formatPercent(figures.ctr)}` },
    { label: t("metric.conversions"), value: formatCount(figures.conversions),
      hint: `${t("metric.cpa")} ${formatRatio(figures.cpa, currency)}` },
    { label: t("metric.cpc"), value: formatRatio(figures.cpc, currency),
      hint: `${t("metric.reach")} ${formatCount(figures.reach)}` },
  ];

  return (
    <div
      role="group"
      aria-label={t("summary.title")}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => <MetricCard key={card.label} {...card} />)}
    </div>
  );
}
