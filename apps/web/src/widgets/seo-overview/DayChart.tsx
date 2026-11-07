import { useId, useState, type PointerEvent } from "react";
import { areaPath, formatDay, linePath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/utils.js";

const BOX = { width: 720, height: 160 };

export interface ChartSeries {
  readonly label: string;
  readonly values: readonly number[];
  readonly format: (value: number) => string;
  readonly stroke: string;
  readonly swatch: string;
  readonly fill?: string;
  readonly dashed?: boolean;
  readonly invert?: boolean;
}

export function DayChart({ title, dates, series }: { title: string; dates: readonly string[]; series: readonly ChartSeries[] }) {
  const [active, setActive] = useState<number | null>(null);
  const tooltipId = useId();

  if (dates.length === 0) {
    return <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">{t("seo.noData")}</div>;
  }

  const left = active === null ? 0 : dates.length === 1 ? 50 : (active / (dates.length - 1)) * 100;
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActive(Math.round(ratio * (dates.length - 1)));
  };

  return (
    <figure className="rounded-lg border border-border p-3">
      <figcaption className="text-sm font-semibold text-foreground">{title}</figcaption>
      <div
        className="relative mt-2 cursor-crosshair rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="group"
        aria-label={title}
        aria-describedby={active === null ? undefined : tooltipId}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(0)}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          const current = active ?? 0;
          const next = event.key === "ArrowRight" ? Math.min(dates.length - 1, current + 1)
            : event.key === "ArrowLeft" ? Math.max(0, current - 1)
              : event.key === "Home" ? 0
                : event.key === "End" ? dates.length - 1
                  : null;
          if (event.key === "Escape") setActive(null);
          if (next === null) return;
          event.preventDefault();
          setActive(next);
        }}
      >
        <svg role="img" aria-label={title} viewBox={`0 0 ${BOX.width} ${BOX.height}`} preserveAspectRatio="none" className="h-32 w-full">
          {series.map((line) => {
            const values = line.invert ? line.values.map((value) => -value) : line.values;
            return (
              <g key={line.label}>
                {line.fill ? <path d={areaPath(values, BOX)} className={line.fill} /> : null}
                <path
                  d={linePath(values, BOX)}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray={line.dashed ? "4 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                  className={line.stroke}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && dates[active] ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/50" style={{ left: `${left}%` }} />
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute top-2 z-10 w-[200px] max-w-full rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md"
              style={{ left: `clamp(0px, calc(${left}% - 100px), max(0px, calc(100% - 200px)))` }}
            >
              <p className="mb-2 font-semibold">
                {new Date(`${dates[active]}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
              </p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
                {series.map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd>{line.format(line.values[active] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatDay(dates[0]!)}</span>
        <span>{formatDay(dates[dates.length - 1]!)}</span>
      </div>
      <ul className="mt-2 flex gap-3 text-xs text-muted-foreground">
        {series.map((line) => (
          <li key={line.label} className="flex items-center gap-1">
            <span aria-hidden className={cn("h-0.5 w-3 rounded", line.swatch)} />
            {line.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
