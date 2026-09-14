import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  kpiMetricDefinition, kpiProgress, useKpi, type KpiFigures, type KpiScope,
} from "@/entities/kpi/index.js";
import { cn, type Currency } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";
import { formatKpiValue } from "./format.js";
import { KpiTargetDialog } from "./KpiTargetDialog.js";

export interface KpiTileProps {
  scope: KpiScope;
  canEdit: boolean;
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  preview?: boolean;
}

const STATUS = { exceeded: "kpi.exceeded", met: "kpi.met" } as const;

export function KpiTile({ scope, canEdit, figures, range, currency, preview = false }: KpiTileProps) {
  const kpi = useKpi(scope);
  const [editing, setEditing] = useState(false);
  const controls = canEdit && !preview;
  const current = kpi.data ?? null;
  const definition = current ? kpiMetricDefinition(current.metric) : null;
  const progress = current ? kpiProgress(figures, current, range) : null;
  const percent = progress?.percent == null ? null : Math.round(progress.percent);
  const achieved = progress?.state === "exceeded" || progress?.state === "met";

  return (
    <div
      data-testid="kpi-tile"
      data-state={progress?.state}
      className="flex h-full flex-col rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {definition ? `${t("summary.kpi")} · ${t(definition.label)}` : t("summary.kpi")}
        </div>
        {controls && current ? (
          <Button type="button" variant="ghost" size="icon-sm" className="-mr-2 -mt-2" aria-label={t("kpi.edit")} onClick={() => setEditing(true)}>
            <Pencil aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {current && definition && progress ? (
        <>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {progress.state === "unmeasured" ? "—" : formatKpiValue(definition.format, progress.actual, currency)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {`${t("kpi.targetShort")} ${formatKpiValue(definition.format, progress.target, currency)}${percent === null ? "" : ` · ${percent}%`}`}
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
            <div className="mt-2 text-xs font-medium text-emerald-600">{t(STATUS[progress.state])}</div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-1 text-sm text-muted-foreground">{kpi.isPending ? "—" : t("kpi.none")}</div>
          {controls && !kpi.isPending ? (
            <Button type="button" variant="outline" size="sm" className="mt-3 self-start" onClick={() => setEditing(true)}>
              {t("kpi.set")}
            </Button>
          ) : null}
        </>
      )}

      {editing ? <KpiTargetDialog scope={scope} kpi={current} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
