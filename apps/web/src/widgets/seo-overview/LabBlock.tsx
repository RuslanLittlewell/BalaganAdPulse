import { useState } from "react";
import { formatDateTime } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { t } from "@/shared/config/index.js";
import { Loader, Tabs } from "@/shared/ui/index.js";
import { useSeoVitals, type SeoDevice, type SeoLab, type SeoRange, type SeoSite } from "@/entities/seo/index.js";
import type { SeoRating } from "@/entities/seo/index.js";
import { decimal, milliseconds, rateLab, RATING_TEXT } from "./format.js";

const BUSY = ["QUEUED", "RUNNING"];

function awaitsMeasurement(site: SeoSite): boolean {
  return BUSY.includes(site.status) || BUSY.includes(site.checkStatus) || (site.lastCheckAt === null && site.checkStatus !== "ERROR");
}

function Figure({ name, value, rating }: { name: string; value: string; rating: SeoRating }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border glass-card p-3">
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd data-rating={rating} className={cn("text-2xl font-semibold tabular-nums", RATING_TEXT[rating])}>{value}</dd>
    </div>
  );
}

function Measurement({ lab }: { lab: SeoLab }) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Figure name={t("seo.lab.score")} value={String(lab.score)} rating={lab.rating} />
        <Figure name="LCP" value={milliseconds(lab.lcpMs)} rating={rateLab("lcpMs", lab.lcpMs)} />
        <Figure name="CLS" value={decimal(lab.cls, 2)} rating={rateLab("cls", lab.cls)} />
        <Figure name="TBT" value={milliseconds(lab.tbtMs)} rating={rateLab("tbtMs", lab.tbtMs)} />
        <Figure name="FCP" value={milliseconds(lab.fcpMs)} rating={rateLab("fcpMs", lab.fcpMs)} />
        <Figure name={t("seo.lab.speedIndex")} value={milliseconds(lab.speedIndexMs)} rating={rateLab("speedIndexMs", lab.speedIndexMs)} />
      </dl>
      <p className="text-xs text-muted-foreground">{t("seo.lab.at")} {formatDateTime(lab.measuredAt)}</p>
    </div>
  );
}

export function LabBlock({ projectId, site, range }: { projectId: string; site: SeoSite; range: SeoRange }) {
  const vitals = useSeoVitals(projectId, site.id, range);
  const [device, setDevice] = useState<SeoDevice>("PHONE");
  const lab = vitals.data?.devices.find((entry) => entry.device === device)?.lab ?? null;
  return (
    <section aria-label={t("seo.lab.title")} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("seo.lab.title")}</h3>
        <Tabs
          items={[{ id: "PHONE", label: t("seo.device.PHONE") }, { id: "DESKTOP", label: t("seo.device.DESKTOP") }]}
          activeId={device}
          onSelect={(id) => setDevice(id as SeoDevice)}
          ariaLabel={t("seo.vitals.devices")}
        />
      </div>
      {lab ? (
        <Measurement lab={lab} />
      ) : !vitals.data || awaitsMeasurement(site) ? (
        <Loader label={t("seo.lab.waiting")} />
      ) : (
        <p className="text-xs text-muted-foreground">{t("seo.lab.none")}</p>
      )}
    </section>
  );
}
