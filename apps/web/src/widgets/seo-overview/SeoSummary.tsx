import { formatCount } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { MetricCard, Skeleton } from "@/shared/ui/index.js";
import { useSeoSearch, type SeoRange, type SeoTotals } from "@/entities/seo/index.js";
import { decimal, percent, position } from "./format.js";

type Trend = "better" | "worse" | "same";

function change(current: number | null, previous: number | null, lowerIsBetter: boolean): { trend: Trend; amount: string } | null {
  if (current === null || previous === null) return null;
  if (lowerIsBetter) {
    const delta = previous - current;
    if (Math.abs(delta) < 0.05) return { trend: "same", amount: "" };
    return { trend: delta > 0 ? "better" : "worse", amount: decimal(Math.abs(delta), 1) };
  }
  if (previous === 0) return null;
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.0005) return { trend: "same", amount: "" };
  return { trend: ratio > 0 ? "better" : "worse", amount: `${decimal(Math.abs(ratio) * 100, 1)}%` };
}

function ChangeHint({ current, previous, lowerIsBetter = false }: { current: number | null; previous: number | null; lowerIsBetter?: boolean }) {
  const found = change(current, previous, lowerIsBetter);
  if (!found) return null;
  if (found.trend === "same") return <span data-trend="same">{t("seo.change.same")}</span>;
  return (
    <span data-trend={found.trend} className={found.trend === "better" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {t(found.trend === "better" ? "seo.change.better" : "seo.change.worse")} {t("seo.change.by")} {found.amount} {t("seo.change.previous")}
    </span>
  );
}

function tiles(totals: SeoTotals, previous: SeoTotals) {
  return [
    { id: "clicks", label: t("seo.metric.clicks"), value: formatCount(totals.clicks), hint: <ChangeHint current={totals.clicks} previous={previous.clicks} /> },
    { id: "impressions", label: t("seo.metric.impressions"), value: formatCount(totals.impressions), hint: <ChangeHint current={totals.impressions} previous={previous.impressions} /> },
    { id: "ctr", label: t("seo.metric.ctr"), value: percent(totals.ctr), hint: <ChangeHint current={totals.ctr} previous={previous.ctr} /> },
    { id: "position", label: t("seo.metric.position"), value: position(totals.position), hint: <ChangeHint current={totals.position} previous={previous.position} lowerIsBetter /> },
  ];
}

export function SeoSummary({ projectId, siteId, range }: { projectId: string; siteId: string; range: SeoRange }) {
  const search = useSeoSearch(projectId, siteId, range);
  if (!search.data) {
    return (
      <div role="status" aria-label={t("seo.importing")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-21 w-full" />)}
      </div>
    );
  }
  return (
    <ul aria-label={t("seo.tab")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {tiles(search.data.totals, search.data.previous).map((tile) => (
        <li key={tile.id}>
          <MetricCard className="h-full" label={tile.label} value={tile.value} hint={tile.hint} />
        </li>
      ))}
    </ul>
  );
}
