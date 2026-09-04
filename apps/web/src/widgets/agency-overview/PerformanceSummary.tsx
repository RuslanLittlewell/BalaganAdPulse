import { MetricCard } from "@/shared/ui/index.js";
import {
  formatCount, formatCurrency, formatMultiple, formatPercent, formatRatio,
} from "@/shared/lib/index.js";
import { EMPTY_PERFORMANCE, type Performance } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export function PerformanceSummary({ performance }: { performance?: Performance }) {
  const figures = performance ?? EMPTY_PERFORMANCE;

  const cards = [
    { label: t("metric.spend"), value: formatCurrency(figures.spend),
      hint: `${t("metric.cpm")} ${formatRatio(figures.cpm)}` },
    { label: t("metric.impressions"), value: formatCount(figures.impressions),
      hint: `${t("metric.frequency")} ${formatMultiple(figures.frequency)}` },
    { label: t("metric.clicks"), value: formatCount(figures.clicks),
      hint: `${t("metric.ctr")} ${formatPercent(figures.ctr)}` },
    { label: t("metric.conversions"), value: formatCount(figures.conversions),
      hint: `${t("metric.cpa")} ${formatRatio(figures.cpa)}` },
    { label: t("metric.revenue"), value: formatCurrency(figures.revenue),
      hint: `${t("metric.roas")} ${formatMultiple(figures.roas)}` },
    { label: t("metric.cpc"), value: formatRatio(figures.cpc),
      hint: `${t("metric.reach")} ${formatCount(figures.reach)}` },
  ];

  return (
    <div
      role="group"
      aria-label={t("summary.title")}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
    >
      {cards.map((card) => <MetricCard key={card.label} {...card} />)}
    </div>
  );
}
