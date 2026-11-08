import { useState } from "react";
import { formatCount } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { t } from "@/shared/config/index.js";
import { Button, Loader } from "@/shared/ui/index.js";
import { useSeoTraffic, type SeoRange, type SeoSite, type SeoTrafficChannel, type SeoTrafficSource } from "@/entities/seo/index.js";
import { analyticsFailureOf, startAnalyticsSignIn } from "@/features/seo-integration/index.js";
import { DayChart } from "./DayChart.js";
import { change, channelName, percent } from "./format.js";

const BUSY = ["QUEUED", "RUNNING"];

function Share({ share }: { share: number }) {
  return (
    <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, share * 100)}%` }} />
    </span>
  );
}

function Channel({ item }: { item: SeoTrafficChannel }) {
  const delta = change(item.sessions, item.previous);
  return (
    <li className="flex flex-col gap-1 px-2 py-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-foreground">{channelName(item.channel)}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(item.sessions)}</span>
      </span>
      <Share share={item.share} />
      <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>{t("seo.traffic.share")} {percent(item.share)}</span>
        {delta ? (
          <span data-trend={delta.trend} className={cn(delta.trend === "up" && "text-emerald-600 dark:text-emerald-400", delta.trend === "down" && "text-red-600 dark:text-red-400")}>
            {delta.text} {t("seo.traffic.vsPrevious")}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function Source({ item }: { item: SeoTrafficSource }) {
  return (
    <li className="flex flex-col gap-1 px-2 py-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-foreground">{item.source} / {item.medium}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(item.sessions)}</span>
      </span>
      <Share share={item.share} />
      <span className="text-xs tabular-nums text-muted-foreground">{t("seo.traffic.share")} {percent(item.share)}</span>
    </li>
  );
}

function ConnectButton({ projectId, siteId }: { projectId: string; siteId: string }) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async () => {
    setPending(true);
    setFailure(null);
    try {
      await startAnalyticsSignIn(projectId, siteId);
    } catch (error) {
      setFailure(analyticsFailureOf(error));
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => void start()}>{t("seo.traffic.connect")}</Button>
      {failure ? <p role="alert" className="text-xs text-destructive">{failure}</p> : null}
    </div>
  );
}

export function TrafficBlock({ projectId, site, range, canManage }: { projectId: string; site: SeoSite; range: SeoRange; canManage: boolean }) {
  const traffic = useSeoTraffic(projectId, site.id, range);
  const data = traffic.data;
  const waiting = site.analytics !== null && BUSY.includes(site.analytics.status) && site.analytics.lastSuccessAt === null;

  const body = () => {
    if (!data || waiting) return <Loader label={t("seo.traffic.waiting")} />;
    if (!data.connected) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{t("seo.traffic.notConnected")}</p>
          {canManage ? <ConnectButton projectId={projectId} siteId={site.id} /> : null}
        </div>
      );
    }
    if (data.status === "AUTH_REQUIRED") {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">{t("seo.traffic.error.token")}</p>
          {canManage ? <ConnectButton projectId={projectId} siteId={site.id} /> : null}
        </div>
      );
    }
    if (data.lastSuccessAt === null && data.status === "ERROR") {
      return <p role="alert" className="text-sm text-destructive">{t("seo.traffic.error.provider")}</p>;
    }
    if (data.totalSessions === 0) return <p className="text-sm text-muted-foreground">{t("seo.traffic.noSessions")}</p>;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">{t("seo.traffic.total")}: <span className="font-semibold text-foreground">{formatCount(data.totalSessions)}</span></p>
        <div className="grid gap-2 lg:grid-cols-2">
          <section aria-label={t("seo.traffic.channels")} className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <h4 className="text-xs font-semibold text-foreground">{t("seo.traffic.channels")}</h4>
            <ul className="flex flex-col">{data.channels.filter((item) => item.sessions > 0).map((item) => <Channel key={item.channel} item={item} />)}</ul>
          </section>
          <section aria-label={t("seo.traffic.sources")} className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <h4 className="text-xs font-semibold text-foreground">{t("seo.traffic.sources")}</h4>
            <ol tabIndex={0} className="flex max-h-[24rem] flex-col overflow-y-auto overscroll-contain rounded-md pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {data.sources.map((item) => <Source key={`${item.source}/${item.medium}`} item={item} />)}
            </ol>
          </section>
        </div>
        <DayChart
          title={t("seo.traffic.days")}
          dates={data.days.map((day) => day.date)}
          series={[{ label: t("seo.traffic.sessions"), values: data.days.map((day) => day.sessions), format: formatCount, stroke: "stroke-primary", swatch: "bg-primary", fill: "fill-primary/10" }]}
        />
      </div>
    );
  };

  return (
    <section aria-label={t("seo.traffic.title")} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{t("seo.traffic.title")}</h3>
      {body()}
    </section>
  );
}
