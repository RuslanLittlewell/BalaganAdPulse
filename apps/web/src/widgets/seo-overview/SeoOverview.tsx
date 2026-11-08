import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { formatCount } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Loader, Skeleton } from "@/shared/ui/index.js";
import { useSeoAuditPages, useSeoSearch, type SeoRange, type SeoSite } from "@/entities/seo/index.js";
import { DayChart } from "./DayChart.js";
import { AuditBlock } from "./AuditBlock.js";
import { PagePanel } from "./PagePanel.js";
import { TopList } from "./TopList.js";
import { LabBlock } from "./LabBlock.js";
import { TrafficBlock } from "./TrafficBlock.js";
import { position, shortDate } from "./format.js";

function SearchCharts({ projectId, site, range }: { projectId: string; site: SeoSite; range: SeoRange }) {
  const search = useSeoSearch(projectId, site.id, range);
  if (!search.data) return <Skeleton className="h-48 w-full" />;
  if (site.lastSuccessAt === null && search.data.days.length === 0) {
    return <div className="flex justify-center rounded-lg border border-border p-6"><Loader label={t("seo.importing")} /></div>;
  }
  const days = search.data.days;
  const dates = days.map((day) => day.date);
  const latest = search.data.latestDay;
  return (
    <div className="flex flex-col gap-2">
      {latest && latest < range.to ? <p className="text-xs text-muted-foreground">{t("seo.latestDay")} {shortDate(latest)}</p> : null}
      <div className="grid gap-2 lg:grid-cols-2">
        <DayChart
          title={t("seo.chart.search")}
          dates={dates}
          series={[
            { label: t("seo.metric.clicks"), values: days.map((day) => day.clicks), format: formatCount, stroke: "stroke-primary", swatch: "bg-primary", fill: "fill-primary/10" },
            { label: t("seo.metric.impressions"), values: days.map((day) => day.impressions), format: formatCount, stroke: "stroke-muted-foreground", swatch: "bg-muted-foreground", dashed: true },
          ]}
        />
        <DayChart
          title={t("seo.chart.position")}
          dates={dates}
          series={[
            { label: t("seo.metric.position"), values: days.map((day) => day.position ?? 0), format: (value) => position(value), stroke: "stroke-primary", swatch: "bg-primary", invert: true },
          ]}
        />
      </div>
    </div>
  );
}

export function SeoOverview({ projectId, site, range, canCheck }: { projectId: string; site: SeoSite; range: SeoRange; canCheck: boolean }) {
  const [pageId, setPageId] = useState<string | null>(null);
  const checked = useSeoAuditPages(projectId, site.id, "ALL");
  const checkedPages = useMemo(() => new Map((checked.data ?? []).map((page) => [page.url, page.id])), [checked.data]);
  return (
    <div className="flex flex-col gap-5">
      <SearchCharts projectId={projectId} site={site} range={range} />
      <TrafficBlock projectId={projectId} site={site} range={range} canManage={canCheck} />
      <LabBlock projectId={projectId} site={site} range={range} />
      <div className="grid gap-2 lg:grid-cols-2">
        <TopList projectId={projectId} siteId={site.id} kind="query" range={range} />
        <TopList projectId={projectId} siteId={site.id} kind="page" range={range} checkedPages={checkedPages} onOpenPage={setPageId} />
      </div>
      <AuditBlock projectId={projectId} siteId={site.id} canCheck={canCheck} onOpenPage={setPageId} />
      <div className="pointer-events-none fixed inset-y-3 right-3 z-40 w-[480px] max-w-[calc(100vw-1.5rem)] [&>*]:pointer-events-auto">
        <AnimatePresence>
          {pageId ? <PagePanel key="seo-page" projectId={projectId} siteId={site.id} pageId={pageId} range={range} onClose={() => setPageId(null)} /> : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
