import { useId } from "react";
import type { DateRange } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { formatDay } from "@/shared/lib/index.js";
import type { KpiCounts } from "./monthlyKpiStandings.js";

const ARC = "M 12 64 A 52 52 0 0 1 116 64";
const HUB = { x: 64, y: 64 };

const PARTS = [
  { key: "met", label: "dashboard.kpi.met", color: "var(--kpi-marker-met)" },
  { key: "behind", label: "dashboard.kpi.behind", color: "var(--kpi-marker-danger)" },
  { key: "unrated", label: "dashboard.kpi.unrated", color: "var(--kpi-marker-none)" },
] as const;

export interface KpiGaugeProps {
  range: DateRange;
  counts?: KpiCounts;
}

function ArcPart({ length, color }: { length: number; color: string }) {
  if (length <= 0) return null;
  return (
    <path
      d={ARC}
      pathLength={100}
      fill="none"
      strokeWidth={12}
      strokeDasharray={`${length} 100`}
      style={{ stroke: color }}
    />
  );
}

export function KpiGauge({ range, counts }: KpiGaugeProps) {
  const titleId = useId();
  const total = counts ? counts.met + counts.behind + counts.unrated : 0;
  const shareOf = (count: number) => (total === 0 ? 0 : (count / total) * 100);
  const metShare = counts ? shareOf(counts.met) : 0;
  const ratedShare = counts ? shareOf(counts.met + counts.behind) : 0;
  const label = counts
    ? `${t("dashboard.kpi.title")}: ${PARTS.map((part) => `${t(part.label)} ${counts[part.key]}`).join(", ")}`
    : t("dashboard.kpi.title");

  return (
    <section aria-labelledby={titleId} className="flex flex-col rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">{t("dashboard.kpi.title")}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDay(range.from)} – {formatDay(range.to)}
        </span>
      </div>

      <svg viewBox="0 0 128 72" role="img" aria-label={label} className="mx-auto mt-4 w-full max-w-72">
        <ArcPart length={100} color={PARTS[2].color} />
        <ArcPart length={ratedShare} color={PARTS[1].color} />
        <ArcPart length={metShare} color={PARTS[0].color} />
        <line
          x1={HUB.x}
          y1={HUB.y}
          x2={HUB.x}
          y2={20}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          className="text-foreground motion-safe:transition-transform motion-safe:duration-700"
          style={{ transform: `rotate(${metShare * 1.8 - 90}deg)`, transformOrigin: `${HUB.x}px ${HUB.y}px` }}
        />
        <circle cx={HUB.x} cy={HUB.y} r={5} className="fill-foreground" />
      </svg>

      <div className="mt-2 text-center">
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {counts && total > 0 ? `${counts.met} ${t("dashboard.kpi.outOf")} ${total}` : "—"}
        </div>
        <div className="text-xs text-muted-foreground">{t("dashboard.kpi.caption")}</div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {PARTS.map((part) => (
          <li key={part.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: part.color }} />
            <span className="flex-1 text-muted-foreground">{t(part.label)}</span>
            <span className="font-medium tabular-nums text-foreground">{counts ? counts[part.key] : "—"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
