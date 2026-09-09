import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import {
  campaignsApi, channelLabel, statusLabel,
  useAdSets, useCampaign, useCampaignDaily,
  type Ad, type DateRange,
} from "@/entities/campaign/index.js";
import { DEFAULT_CURRENCY, useActiveCampaignId, useActiveProjectId, useProjects } from "@/entities/project/index.js";
import { useTasks, type Task } from "@/entities/task/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { TaskPreviewDialog } from "@/features/task-management/index.js";
import { TaskList } from "@/widgets/task-list/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import { DailyChart } from "@/widgets/campaign-overview/index.js";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";
import { CreativePreviewDialog } from "@/widgets/creative-preview/index.js";

function useAdsOfOpenSets(openIds: ReadonlySet<string>, range: DateRange) {
  const ids = [...openIds];
  const results = useQueries({
    queries: ids.map((adSetId) => ({
      queryKey: ["ad-sets", adSetId, "ads", { from: range.from, to: range.to }],
      queryFn: () => campaignsApi.ads(adSetId, range),
    })),
  });
  return new Map(ids.map((id, index) => [id, (results[index]?.data ?? []) as Ad[]]));
}

export function CampaignPage() {
  const campaignId = useActiveCampaignId();
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const location = useLocation();
  const { range } = usePeriod();
  const campaign = useCampaign(campaignId, range);
  const days = useCampaignDaily(campaignId, range);
  const adSets = useAdSets(campaignId, range);
  const projects = useProjects();
  const [openSets, setOpenSets] = useState<ReadonlySet<string>>(new Set());
  const [reading, setReading] = useState<Task | null>(null);
  const [previewing, setPreviewing] = useState<{ adSetId: string; adId: string } | null>(null);
  const tasks = useTasks({ campaignId, enabled: campaignId != null });
  const adsBySet = useAdsOfOpenSets(openSets, range);

  if (campaign.isError) return <EmptyState title={t("campaign.notFound.title")} />;

  const currency = projects.data?.find((candidate) => candidate.id === projectId)?.budgetCurrency
    ?? DEFAULT_CURRENCY;

  const rows: PerformanceRow[] = (adSets.data ?? []).map((adSet) => ({
    id: adSet.id,
    name: adSet.name,
    note: [adSet.audience, statusLabel(adSet.status)].filter(Boolean).join(" · "),
    performance: adSet.performance,
    expandable: true,
    children: (adsBySet.get(adSet.id) ?? []).map((ad) => ({
      id: ad.id,
      name: ad.name,
      note: [ad.format, statusLabel(ad.status)].filter(Boolean).join(" · "),
      performance: ad.performance,
    })),
  }));

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("campaign.back")}
            onClick={() => { if (projectId) navigate(`${projectPath(projectId)}${location.search}`); }}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">
            {campaign.data?.name ?? ""}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {campaign.data == null ? "" : [
              channelLabel(campaign.data.channel),
              statusLabel(campaign.data.status),
              campaign.data.objective,
            ].filter(Boolean).join(" · ")}
          </p>
          </div>
        </div>
        <PeriodControl />
      </header>

      <PerformanceSummary performance={campaign.data?.performance} currency={currency} />

      <DailyChart days={days.data ?? []} currency={currency} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("adSets.title")}</h2>
        <PerformanceTable
          heading={t("adSets.one")}
          rows={rows}
          currency={currency}
          onExpandedChange={setOpenSets}
          onOpen={(adId) => {
            for (const [adSetId, ads] of adsBySet) {
              if (ads.some((ad) => ad.id === adId)) setPreviewing({ adSetId, adId });
            }
          }}
          empty={adSets.isSuccess ? t("adSets.empty") : undefined}
        />
      </div>

      <TaskList
        title={t("tasks.ofCampaign.title")}
        tasks={tasks.data ?? []}
        empty={t("tasks.ofCampaign.empty")}
        onOpen={setReading}
      />

      {reading ? (
        <TaskPreviewDialog task={reading} onClose={() => setReading(null)} />
      ) : null}

      {previewing ? (
        <CreativePreviewDialog
          ads={adsBySet.get(previewing.adSetId) ?? []}
          initialAdId={previewing.adId}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
