import { Fragment, useState, type ReactNode } from "react";
import {
  cn,
  formatCount,
  formatCurrency,
  formatMultiple,
  formatPercent,
  formatRatio,
} from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import {
  EMPTY_PERFORMANCE,
  type Performance,
  type CurrencyPerformance,
} from "@/entities/campaign/index.js";
import type { KpiScope } from "@/entities/kpi/index.js";
import { KpiTile } from "@/features/kpi-target/index.js";
import { t } from "@/shared/config/index.js";
import {
  AddTile,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  MetricCard,
  RollingNumber,
} from "@/shared/ui/index.js";
import {
  chosenTiles,
  MAX_SUMMARY_TILES,
  SUMMARY_TILES,
  toggledTiles,
  type SummaryTile,
} from "./summaryTiles.js";

export interface PerformanceSummaryProps {
  tiles: readonly SummaryTile[];
  onTilesChange?: (tiles: SummaryTile[]) => void;
  range: { from: string; to: string };
  performance?: Performance;
  currency?: Currency;
  currencyPerformances?: CurrencyPerformance[];
  kpi?: { scope: KpiScope; canEdit: boolean };
}

const LABELS: Record<SummaryTile, string> = {
  SPEND: t("metric.spend"),
  IMPRESSIONS: t("metric.impressions"),
  CLICKS: t("metric.clicks"),
  CONVERSIONS: t("metric.conversions"),
  RESULTS: t("metric.results"),
  CPC: t("metric.cpc"),
  KPI: t("summary.kpi"),
};

export function PerformanceSummary({
  tiles,
  onTilesChange,
  range,
  performance,
  currency = "RUB",
  currencyPerformances,
  kpi,
}: PerformanceSummaryProps) {
  const groups = currencyPerformances?.length
    ? currencyPerformances
    : [{ currency, performance: performance ?? EMPTY_PERFORMANCE }];
  const figures = currencyPerformances
    ? groups.reduce(
        (total, group) => ({
          ...total,
          impressions: total.impressions + group.performance.impressions,
          reach: total.reach + group.performance.reach,
          clicks: total.clicks + group.performance.clicks,
          conversions: total.conversions + group.performance.conversions,
          results: total.results + group.performance.results,
        }),
        { ...EMPTY_PERFORMANCE },
      )
    : (performance ?? EMPTY_PERFORMANCE);
  if (currencyPerformances) {
    figures.ctr = figures.impressions
      ? (figures.clicks * 100) / figures.impressions
      : null;
    figures.frequency = figures.reach
      ? figures.impressions / figures.reach
      : null;
  }
  const monetary = (
    format: (p: Performance, currency: Currency) => ReactNode,
  ) => (
    <>
      {groups.map((group) => (
        <div key={group.currency ?? "unknown"}>
          {format(group.performance, group.currency)}
        </div>
      ))}
    </>
  );
  const [configuring, setConfiguring] = useState(false);
  const configurable = onTilesChange !== undefined;

  const offered = SUMMARY_TILES.filter(
    (tile) => tile !== "KPI" || kpi !== undefined,
  );
  const chosen = chosenTiles(tiles, offered);
  const atLimit = chosen.length >= MAX_SUMMARY_TILES;

  const render = (tile: SummaryTile, preview = false): ReactNode => {
    switch (tile) {
      case "SPEND":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.SPEND}
            value={monetary((p, c) => (
              <RollingNumber value={formatCurrency(p.spend, c)} />
            ))}
            hint={monetary(
              (p, c) => `${t("metric.cpm")} ${formatRatio(p.cpm, c)}`,
            )}
          />
        );
      case "IMPRESSIONS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.IMPRESSIONS}
            value={formatCount(figures.impressions)}
            hint={`${t("metric.frequency")} ${formatMultiple(figures.frequency)}`}
          />
        );
      case "CLICKS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CLICKS}
            value={formatCount(figures.clicks)}
            hint={`${t("metric.ctr")} ${formatPercent(figures.ctr)}`}
          />
        );
      case "CONVERSIONS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CONVERSIONS}
            value={formatCount(figures.conversions)}
            hint={monetary(
              (p, c) => `${t("metric.cpa")} ${formatRatio(p.cpa, c)}`,
            )}
          />
        );
      case "RESULTS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.RESULTS}
            value={formatCount(figures.results)}
            hint={monetary(
              (p, c) => `${t("metric.costPerResult")} ${formatRatio(p.costPerResult, c)}`,
            )}
          />
        );
      case "CPC":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CPC}
            value={monetary((p, c) => (
              <RollingNumber value={formatRatio(p.cpc, c)} />
            ))}
            hint={`${t("metric.reach")} ${formatCount(figures.reach)}`}
          />
        );
      case "KPI":
        return kpi ? (
          <KpiTile
            {...kpi}
            figures={figures}
            range={range}
            currency={currency}
            currencyFigures={currencyPerformances}
            preview={preview}
          />
        ) : null;
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label={t("summary.title")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {chosen.map((tile) =>
          tile === "KPI" && kpi?.scope.kind === "project" ? (
            <Fragment key={tile}>{render(tile)}</Fragment>
          ) : (
            <div key={tile} data-testid="summary-tile" data-tile={tile}>
              {render(tile)}
            </div>
          ),
        )}
        {configurable ? (
          <AddTile
            label={t("summary.configure")}
            onClick={() => setConfiguring(true)}
          />
        ) : null}
      </div>

      <Dialog open={configurable && configuring} onOpenChange={setConfiguring}>
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>{t("summary.title")}</DialogTitle>
              <span className="text-sm tabular-nums text-muted-foreground">
                {chosen.length}/{MAX_SUMMARY_TILES}
              </span>
            </div>
            <DialogDescription>
              {atLimit ? t("summary.limit") : t("summary.choose")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  onClick={() =>
                    onTilesChange?.(toggledTiles(tiles, tile, offered))
                  }
                  className={cn(
                    "h-full rounded-xl border-2 p-1 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <div className="pointer-events-none h-full">
                    {render(tile, true)}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
