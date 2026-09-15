import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  cn, formatCount, formatCurrency, formatMultiple, formatPercent, formatRatio,
} from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import { EMPTY_PERFORMANCE, type Performance } from "@/entities/campaign/index.js";
import type { KpiScope } from "@/entities/kpi/index.js";
import { useAuth } from "@/features/auth/index.js";
import { KpiTile } from "@/features/kpi-target/index.js";
import { t } from "@/shared/config/index.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, MetricCard } from "@/shared/ui/index.js";
import {
  chosenTiles, MAX_SUMMARY_TILES, SUMMARY_TILES, useSummaryTiles, type SummaryScreen, type SummaryTile,
} from "./summaryTiles.js";

export interface PerformanceSummaryProps {
  screen: SummaryScreen;
  range: { from: string; to: string };
  performance?: Performance;
  currency?: Currency;
  kpi?: { scope: KpiScope; canEdit: boolean };
  configurable?: boolean;
}

const LABELS: Record<SummaryTile, string> = {
  spend: t("metric.spend"),
  impressions: t("metric.impressions"),
  clicks: t("metric.clicks"),
  conversions: t("metric.conversions"),
  cpc: t("metric.cpc"),
  kpi: t("summary.kpi"),
};

export function PerformanceSummary({
  screen, range, performance, currency = "RUB", kpi, configurable = true,
}: PerformanceSummaryProps) {
  const figures = performance ?? EMPTY_PERFORMANCE;
  const { user } = useAuth();
  const layouts = useSummaryTiles((state) => state.layouts);
  const toggleTile = useSummaryTiles((state) => state.toggleTile);
  const [configuring, setConfiguring] = useState(false);

  const offered = SUMMARY_TILES.filter((tile) => tile !== "kpi" || kpi !== undefined);
  const chosen = chosenTiles(layouts, user?.id, screen, offered);
  const atLimit = chosen.length >= MAX_SUMMARY_TILES;

  const render = (tile: SummaryTile, preview = false): ReactNode => {
    switch (tile) {
      case "spend":
        return <MetricCard className="h-full" label={LABELS.spend} value={formatCurrency(figures.spend, currency)}
          hint={`${t("metric.cpm")} ${formatRatio(figures.cpm, currency)}`} />;
      case "impressions":
        return <MetricCard className="h-full" label={LABELS.impressions} value={formatCount(figures.impressions)}
          hint={`${t("metric.frequency")} ${formatMultiple(figures.frequency)}`} />;
      case "clicks":
        return <MetricCard className="h-full" label={LABELS.clicks} value={formatCount(figures.clicks)}
          hint={`${t("metric.ctr")} ${formatPercent(figures.ctr)}`} />;
      case "conversions":
        return <MetricCard className="h-full" label={LABELS.conversions} value={formatCount(figures.conversions)}
          hint={`${t("metric.cpa")} ${formatRatio(figures.cpa, currency)}`} />;
      case "cpc":
        return <MetricCard className="h-full" label={LABELS.cpc} value={formatRatio(figures.cpc, currency)}
          hint={`${t("metric.reach")} ${formatCount(figures.reach)}`} />;
      case "kpi":
        return kpi ? <KpiTile {...kpi} figures={figures} range={range} currency={currency} preview={preview} /> : null;
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label={t("summary.title")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {chosen.map((tile) => (
          <div key={tile} data-testid="summary-tile" data-tile={tile}>{render(tile)}</div>
        ))}
        {configurable ? (
          <button
            type="button"
            aria-label={t("summary.configure")}
            onClick={() => setConfiguring(true)}
            className={cn(
              "grid min-h-24 place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground",
              "transition-colors hover:border-primary hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Plus aria-hidden className="size-6" />
          </button>
        ) : null}
      </div>

      <Dialog open={configurable && configuring} onOpenChange={setConfiguring}>
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>{t("summary.title")}</DialogTitle>
              <span className="text-sm tabular-nums text-muted-foreground">{chosen.length}/{MAX_SUMMARY_TILES}</span>
            </div>
            <DialogDescription>{atLimit ? t("summary.limit") : t("summary.choose")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offered.map((tile) => {
              const selected = chosen.includes(tile);
              return (
                <button
                  key={tile}
                  type="button"
                  aria-label={LABELS[tile]}
                  aria-pressed={selected}
                  data-selected={selected ? "true" : "false"}
                  disabled={!selected && atLimit}
                  onClick={() => { if (user) toggleTile(user.id, screen, tile, offered); }}
                  className={cn(
                    "rounded-xl border-2 p-1 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected ? "border-primary bg-primary/5" : "border-transparent hover:border-border",
                  )}
                >
                  <div className="pointer-events-none">{render(tile, true)}</div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
