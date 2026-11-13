import { useState } from "react";
import { formatDateTime } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, ProviderLogo } from "@/shared/ui/index.js";
import { useModuleEnabled } from "@/features/auth/index.js";
import { useConversionsSummary } from "../api/conversions.js";
import { DatasetSettingsDialog } from "./DatasetSettingsDialog.js";
import { SendLogDialog } from "./SendLogDialog.js";

export function ConversionsApiCard({ projectId }: { projectId: string }) {
  return useModuleEnabled("CRM") ? <ConversionsApiPanel projectId={projectId} /> : null;
}

function ConversionsApiPanel({ projectId }: { projectId: string }) {
  const summary = useConversionsSummary(projectId);
  const [configuring, setConfiguring] = useState(false);
  const [reading, setReading] = useState(false);
  const dataset = summary.data?.dataset ?? null;
  const counts = summary.data?.counts;

  return (
    <section
      className="flex max-w-xs flex-col justify-between gap-2 rounded-lg border border-border glass-card p-3"
      aria-label={t("capi.title")}
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ProviderLogo provider="META" className="size-3 shrink-0" />
          {t("capi.title")}
        </h2>
        {summary.isError && <p role="alert" className="text-xs text-destructive">{t("capi.error.read")}</p>}
        {summary.isSuccess && !dataset && <p className="text-xs text-muted-foreground">{t("capi.notConnected")}</p>}
        {dataset && (
          <p
            role={dataset.state === "AUTH_REQUIRED" ? "alert" : undefined}
            className={dataset.state === "AUTH_REQUIRED" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {t(`capi.state.${dataset.state}`)}
          </p>
        )}
        {dataset?.testEventCode && <p className="text-xs text-amber-600 dark:text-amber-400">{t("capi.testMode")}</p>}
        {dataset?.lastSentAt && (
          <p className="text-xs text-muted-foreground">{t("capi.lastSent")} {formatDateTime(dataset.lastSentAt)}</p>
        )}
        {dataset && counts && (
          <dl aria-label={t("capi.counts")} className="grid grid-cols-3 gap-2 pt-1 text-center">
            {(["today", "week", "month"] as const).map((period) => (
              <div key={period} className="grid gap-0.5">
                <dt className="text-[11px] text-muted-foreground">{t(`capi.counts.${period}`)}</dt>
                <dd className="text-sm font-semibold tabular-nums">{counts[period]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!summary.isSuccess} onClick={() => setConfiguring(true)}>
          {dataset ? t("capi.configure") : t("capi.connect")}
        </Button>
        {dataset && (
          <Button variant="outline" size="sm" onClick={() => setReading(true)}>
            {t("capi.log")}
          </Button>
        )}
      </div>
      {configuring && summary.data && (
        <DatasetSettingsDialog projectId={projectId} dataset={dataset} onClose={() => setConfiguring(false)} />
      )}
      {reading && summary.data && <SendLogDialog sends={summary.data.recent} onClose={() => setReading(false)} />}
    </section>
  );
}
