import { areaPath, formatCurrency, formatDay, linePath } from "@/shared/lib/index.js";
import type { MeasuredDay } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

const BOX = { width: 720, height: 180 };

export function DailyChart({ days }: { days: MeasuredDay[] }) {
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
          {t("chart.peak")}: {formatCurrency(highest)}
        </span>
      </figcaption>
      <svg
        role="img"
        aria-label={t("dashboard.spendByDay")}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        preserveAspectRatio="none"
        className="mt-3 h-44 w-full"
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
