import { useState } from "react";
import { formatDateTime } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { t } from "@/shared/config/index.js";
import { Skeleton, Sparkline, Tabs } from "@/shared/ui/index.js";
import { useSeoVitals, type SeoDevice, type SeoDeviceVitals, type SeoLab, type SeoRange, type SeoVitalMetric } from "@/entities/seo/index.js";
import { decimal, metricValue, milliseconds, RATING_FILL, RATING_TEXT, shortDate } from "./format.js";

const CORE = new Set(["LCP", "INP", "CLS"]);

function ShareBar({ metric }: { metric: SeoVitalMetric }) {
  const parts = [
    { rating: "GOOD" as const, share: metric.good },
    { rating: "NEEDS_IMPROVEMENT" as const, share: metric.needsImprovement },
    { rating: "POOR" as const, share: metric.poor },
  ];
  const label = parts.map((part) => `${t(`seo.rating.${part.rating}`)} ${Math.round(part.share * 100)}%`).join(", ");
  return (
    <div role="img" aria-label={label} className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {parts.map((part) => (
        <span key={part.rating} className={RATING_FILL[part.rating]} style={{ width: `${part.share * 100}%` }} />
      ))}
    </div>
  );
}

function MetricTile({ metric }: { metric: SeoVitalMetric }) {
  const core = CORE.has(metric.metric);
  return (
    <li
      aria-label={`${metric.metric}: ${metricValue(metric.metric, metric.p75)}, ${t(`seo.rating.${metric.rating}`)}`}
      className={cn("flex flex-col gap-2 rounded-lg border border-border glass-card p-3", core ? "" : "opacity-90")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{metric.metric}</span>
        <span className="truncate text-xs text-muted-foreground">{t(`seo.metricName.${metric.metric}`)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-semibold tabular-nums", core ? "text-2xl" : "text-lg", RATING_TEXT[metric.rating])}>
          {metricValue(metric.metric, metric.p75)}
        </span>
        <span className={cn("text-xs", RATING_TEXT[metric.rating])}>{t(`seo.rating.${metric.rating}`)}</span>
      </div>
      <ShareBar metric={metric} />
      {metric.weeks.length > 1 ? (
        <Sparkline values={metric.weeks.map((week) => week.p75)} label={`${metric.metric}: ${t("seo.vitals.weeks")}`} width={160} height={24} className="w-full" />
      ) : null}
    </li>
  );
}

function LabMeasurement({ lab }: { lab: SeoLab | null }) {
  return (
    <section aria-label={t("seo.lab.title")} className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <h4 className="text-xs font-semibold text-foreground">{t("seo.lab.title")}</h4>
      {lab ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tabular-nums", RATING_TEXT[lab.rating])}>{lab.score}</span>
            <span className="text-xs text-muted-foreground">{t("seo.lab.score")} · {t(`seo.rating.${lab.rating}`)}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
            <dt className="text-muted-foreground">LCP</dt><dd>{milliseconds(lab.lcpMs)}</dd>
            <dt className="text-muted-foreground">CLS</dt><dd>{decimal(lab.cls, 2)}</dd>
            <dt className="text-muted-foreground">TBT</dt><dd>{milliseconds(lab.tbtMs)}</dd>
            <dt className="text-muted-foreground">FCP</dt><dd>{milliseconds(lab.fcpMs)}</dd>
            <dt className="text-muted-foreground">{t("seo.lab.speedIndex")}</dt><dd>{milliseconds(lab.speedIndexMs)}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">{t("seo.lab.at")} {formatDateTime(lab.measuredAt)}</p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("seo.lab.none")}</p>
      )}
    </section>
  );
}

function DeviceVitals({ vitals, configured, read }: { vitals: SeoDeviceVitals | undefined; configured: boolean; read: boolean }) {
  const field = !configured
    ? <p className="text-sm text-muted-foreground">{t("seo.vitals.notConfigured")}</p>
    : !read
      ? <p className="text-sm text-muted-foreground">{t("seo.vitals.waiting")}</p>
      : !vitals || vitals.metrics.length === 0
        ? <p className="text-sm text-muted-foreground">{t("seo.vitals.fewVisits")}</p>
        : (
          <div className="flex flex-col gap-2">
            {vitals.passes !== null ? (
              <p className={cn("text-sm font-medium", vitals.passes ? RATING_TEXT.GOOD : RATING_TEXT.POOR)}>
                {t(vitals.passes ? "seo.vitals.pass" : "seo.vitals.fail")}
              </p>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {vitals.metrics.map((metric) => <MetricTile key={metric.metric} metric={metric} />)}
            </ul>
            {vitals.periodEnd ? <p className="text-xs text-muted-foreground">{t("seo.vitals.field")} {shortDate(vitals.periodEnd)}</p> : null}
          </div>
        );
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
      {field}
      <LabMeasurement lab={vitals?.lab ?? null} />
    </div>
  );
}

export function VitalsBlock({ projectId, siteId, range }: { projectId: string; siteId: string; range: SeoRange }) {
  const vitals = useSeoVitals(projectId, siteId, range);
  const [device, setDevice] = useState<SeoDevice>("PHONE");
  return (
    <section aria-label={t("seo.vitals.title")} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("seo.vitals.title")}</h3>
        <Tabs
          items={[{ id: "PHONE", label: t("seo.device.PHONE") }, { id: "DESKTOP", label: t("seo.device.DESKTOP") }]}
          activeId={device}
          onSelect={(id) => setDevice(id as SeoDevice)}
          ariaLabel={t("seo.vitals.devices")}
        />
      </div>
      {vitals.data ? (
        <DeviceVitals
          vitals={vitals.data.devices.find((entry) => entry.device === device)}
          configured={vitals.data.configured}
          read={vitals.data.readAt !== null}
        />
      ) : (
        <Skeleton className="h-32 w-full" />
      )}
    </section>
  );
}
