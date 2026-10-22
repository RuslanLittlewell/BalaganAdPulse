import { Fragment } from "react";
import { Pencil } from "lucide-react";
import {
  kpiMetricDefinition,
  kpiProgress,
  MANUAL_KPI,
  type KpiFigures,
  type KpiFormat,
  type KpiInput,
} from "@/entities/kpi/index.js";
import { cn, type Currency } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, RollingNumber } from "@/shared/ui/index.js";
import { formatKpiValue } from "./format.js";

const STATUS = { exceeded: "kpi.exceeded", met: "kpi.met" } as const;

export interface KpiCardProps {
  kpi: KpiInput | null;
  enabled?: boolean;
  pending: boolean;
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  currencyFigures?: { currency: Currency; performance: KpiFigures }[];
  controls: boolean;
  onEdit: () => void;
  testId?: string;
}

export function KpiCard({
  kpi: current,
  enabled = true,
  pending,
  figures,
  range,
  currency,
  currencyFigures,
  controls,
  onEdit,
  testId = "kpi-tile",
}: KpiCardProps) {
  const definition = current && current.metric !== MANUAL_KPI ? kpiMetricDefinition(current.metric) ?? null : null;
  const title = current?.metric === MANUAL_KPI ? current.name : definition ? t(definition.label) : null;
  const format: KpiFormat | null = current?.metric === MANUAL_KPI ? "number" : definition?.format ?? null;
  const progress = current && format ? kpiProgress(figures, current, range) : null;
  const monetary =
    definition?.format === "currency" ||
    definition?.format === "ratio" ||
    definition?.figure === "roas";
  const rows =
    current && monetary && currencyFigures?.length
      ? currencyFigures.map((group) => ({
          currency: group.currency,
          progress: kpiProgress(group.performance, current, range),
        }))
      : [{ currency, progress }];

  return (
    <div
      data-testid={testId}
      data-state={rows.length === 1 ? rows[0]?.progress?.state : undefined}
      data-enabled={enabled}
      className="flex h-full flex-col rounded-lg border border-border glass-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span
            role="img"
            aria-label={t(enabled ? "kpi.on" : "kpi.off")}
            title={t(enabled ? "kpi.on" : "kpi.off")}
            className={cn("size-2 shrink-0 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground/50")}
          />
          {title ? `${t("summary.kpi")} · ${title}` : t("summary.kpi")}
        </div>
        {controls && current ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mr-2 -mt-2"
            aria-label={t("kpi.edit")}
            onClick={onEdit}
          >
            <Pencil aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {current && format && progress ? (
        <>
          {rows.map(
            ({ currency: rowCurrency, progress: rowProgress }, index) => {
              const progress = rowProgress!;
              const percent =
                progress.percent == null ? null : Math.round(progress.percent);
              const achieved =
                progress.state === "exceeded" || progress.state === "met";
              return (
                <Fragment key={index}>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {definition?.figure === "roas" &&
                    currencyFigures &&
                    rowCurrency
                      ? `${rowCurrency} · `
                      : ""}
                    <RollingNumber
                      value={
                        progress.state === "unmeasured"
                          ? "—"
                          : formatKpiValue(
                              format,
                              progress.actual,
                              rowCurrency,
                            )
                      }
                    />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {`${t("kpi.targetShort")} ${formatKpiValue(format, progress.target, rowCurrency)}${percent === null ? "" : ` · ${percent}%`}`}
                  </div>
                  {progress.state === "unmeasured" ? null : (
                    <div
                      role="progressbar"
                      aria-label={t("kpi.progress")}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, percent ?? 100)}
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          achieved ? "bg-emerald-500" : "bg-amber-500",
                          progress.state === "exceeded" && "kpi-exceeded-bar",
                        )}
                        style={{ width: `${Math.min(100, percent ?? 100)}%` }}
                      />
                    </div>
                  )}
                  {progress.state === "exceeded" || progress.state === "met" ? (
                    <div className="mt-2 text-xs font-medium text-emerald-600">
                      {t(STATUS[progress.state])}
                    </div>
                  ) : null}
                </Fragment>
              );
            },
          )}
        </>
      ) : (
        <>
          <div className="mt-1 text-sm text-muted-foreground">
            {pending ? "—" : t("kpi.none")}
          </div>
          {controls && !pending ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 self-start"
              onClick={onEdit}
            >
              {t("kpi.set")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
