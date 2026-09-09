import { useId, useState, type PointerEvent } from "react";
import { areaPath, formatCount, formatCurrency, formatDay, linePath } from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import type { MeasuredDay } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

const BOX = { width: 720, height: 180 };

export function DailyChart({
  days,
  currency = "RUB",
}: {
  days: MeasuredDay[];
  currency?: Currency;
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const tooltipId = useId();
  const activeIndex = days.findIndex((day) => day.date === activeDate);
  const activeDay = days[activeIndex];
  const activePosition = days.length === 1 ? 50 : activeIndex / (days.length - 1) * 100;

  const selectAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || days.length === 0) return;
    const position = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActiveDate(days[Math.round(position * (days.length - 1))].date);
  };

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        {t("chart.empty")}
      </div>
    );
  }

  const spend = days.map((day) => day.spend);
  const conversions = days.map((day) => day.conversions);
  const highest = Math.max(...spend);

  return (
    <figure className="rounded-lg border border-border p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{t("chart.title")}</span>
        <span className="text-xs text-muted-foreground">
          {t("chart.peak")}: {formatCurrency(highest, currency)}
        </span>
      </figcaption>
      <div
        className="relative mt-3 cursor-crosshair rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="group"
        aria-label={t("chart.title")}
        aria-describedby={activeDay ? tooltipId : undefined}
        tabIndex={0}
        onPointerMove={selectAtPointer}
        onPointerDown={selectAtPointer}
        onPointerLeave={() => setActiveDate(null)}
        onFocus={() => setActiveDate(days[0].date)}
        onBlur={() => setActiveDate(null)}
        onKeyDown={(event) => {
          let index = activeIndex;
          switch (event.key) {
            case "ArrowRight": index = Math.min(days.length - 1, activeIndex + 1); break;
            case "ArrowLeft": index = Math.max(0, activeIndex - 1); break;
            case "Home": index = 0; break;
            case "End": index = days.length - 1; break;
            case "Escape": setActiveDate(null); return;
            default: return;
          }
          event.preventDefault();
          setActiveDate(days[index].date);
        }}
      >
        <svg
          role="img"
          aria-label={t("dashboard.spendByDay")}
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          preserveAspectRatio="none"
          className="h-44 w-full"
        >
          <path d={areaPath(spend, BOX)} className="fill-primary/10" />
          <path
            d={linePath(spend, BOX)}
            fill="none"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="stroke-primary"
          />
          <path
            d={linePath(conversions, BOX)}
            fill="none"
            strokeWidth={2}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-muted-foreground"
          />
        </svg>
        {activeDay && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/50"
              style={{ left: `${activePosition}%` }}
            />
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute top-2 z-10 w-[200px] max-w-full rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md"
              style={{ left: `clamp(0px, calc(${activePosition}% - 100px), max(0px, calc(100% - 200px)))` }}
            >
              <p className="mb-2 font-semibold">
                {new Date(`${activeDay.date}T00:00:00Z`).toLocaleDateString("ru-RU", {
                  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                })}
              </p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
                <dt className="text-muted-foreground">{t("metric.spend")}</dt>
                <dd>{formatCurrency(activeDay.spend, currency)}</dd>
                <dt className="text-muted-foreground">{t("metric.conversions")}</dt>
                <dd>{formatCount(activeDay.conversions)}</dd>
              </dl>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatDay(days[0].date)}</span>
        <span>{formatDay(days[days.length - 1].date)}</span>
      </div>
      <ul className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-primary" />{t("metric.spend")}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-muted-foreground" />
          {t("metric.conversions")}
        </li>
      </ul>
    </figure>
  );
}
