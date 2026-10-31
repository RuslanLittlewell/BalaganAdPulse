import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, EmptyState, Switch } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import {
  campaignsApi,
  channelLabel,
  isRunning,
  resultTypeFiguresOf,
  statusLabel,
  useAdSets,
  useCampaign,
  useCampaignDaily,
  type Ad,
  type Campaign,
  type DateRange,
  type DeliveryStatus,
} from "@/entities/campaign/index.js";
import {
  useActiveCampaignId,
  useActiveProjectId,
  useProjects,
} from "@/entities/project/index.js";
import { tilesOf, useSummaryTiles, type SummaryAccount, type SummaryTile } from "@/entities/summary-tiles/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { useCan } from "@/features/permissions/index.js";
import { usePreviewMode } from "@/features/preview-mode/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import { DailyChart } from "@/widgets/campaign-overview/index.js";
import {
  PerformanceTable,
  resultTypeColumns,
  type PerformanceRow,
} from "@/widgets/performance-table/index.js";
import { CreativePreviewDialog } from "@/widgets/creative-preview/index.js";

function runningFirst<T extends { status: DeliveryStatus }>(items: readonly T[], runningOnly: boolean): T[] {
  const running = items.filter((item) => isRunning(item.status));
  return runningOnly ? running : [...running, ...items.filter((item) => !isRunning(item.status))];
}

const accountOf = (campaign: Campaign | undefined): SummaryAccount | null =>
  campaign?.sourceAccountId ? { channel: campaign.channel, accountId: campaign.sourceAccountId } : null;

const withKpi = (tiles: readonly SummaryTile[]): SummaryTile[] =>
  tiles.includes("KPI") ? [...tiles] : [...tiles, "KPI"];

function useAdsOfOpenSets(openIds: ReadonlySet<string>, range: DateRange) {
  const ids = [...openIds];
  const results = useQueries({
    queries: ids.map((adSetId) => ({
      queryKey: ["ad-sets", adSetId, "ads", { from: range.from, to: range.to }],
      queryFn: () => campaignsApi.ads(adSetId, range),
    })),
  });
  return new Map(
    ids.map((id, index) => [id, (results[index]?.data ?? []) as Ad[]]),
  );
}

export function CampaignPage() {
  const campaignId = useActiveCampaignId();
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const location = useLocation();
  const { range } = usePeriod();
  const { previewing: inPreview } = usePreviewMode();
  const editsKpi = useCan("update", "kpi");
  const campaign = useCampaign(campaignId, range);
  const days = useCampaignDaily(campaignId, range);
  const adSets = useAdSets(campaignId, range);
  const projects = useProjects();
  const projectTiles = useSummaryTiles(
    projectId ? { kind: "project", id: projectId } : undefined,
  );
  const [openSets, setOpenSets] = useState<ReadonlySet<string>>(new Set());
  const [previewing, setPreviewing] = useState<{
    adSetId: string;
    adId: string;
  } | null>(null);
  const adsBySet = useAdsOfOpenSets(openSets, range);
  const [runningOnly, setRunningOnly] = useState(true);
  useEffect(() => {
    setRunningOnly(true);
  }, [campaignId]);

  if (campaign.isError)
    return <EmptyState title={t("campaign.notFound.title")} />;

  const currency =
    projects.data?.find((candidate) => candidate.id === projectId)
      ?.budgetCurrency ?? null;

  const offeredTypes = campaign.data?.resultTypes ?? [];

  const allAdSets = adSets.data ?? [];
  const listedAds = (adSetId: string) => runningFirst(adsBySet.get(adSetId) ?? [], runningOnly);

  const rows: PerformanceRow[] = runningFirst(allAdSets, runningOnly).map((adSet) => ({
    id: adSet.id,
    name: adSet.name,
    note: [adSet.audience, statusLabel(adSet.status)]
      .filter(Boolean)
      .join(" · "),
    performance: adSet.performance,
    extra: resultTypeFiguresOf(adSet.performance, offeredTypes),
    expandable: true,
    children: listedAds(adSet.id).map((ad) => ({
      id: ad.id,
      name: ad.name,
      note: [ad.format, statusLabel(ad.status)].filter(Boolean).join(" · "),
      performance: ad.performance,
      extra: resultTypeFiguresOf(ad.performance, offeredTypes),
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
            onClick={() => {
              if (projectId)
                navigate(`${projectPath(projectId)}${location.search}`);
            }}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              {campaign.data?.name ?? ""}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {campaign.data == null
                ? ""
                : [
                    channelLabel(campaign.data.channel),
                    statusLabel(campaign.data.status),
                    campaign.data.objective,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>
        <PeriodControl />
      </header>

      <PerformanceSummary
        tiles={projectTiles.data ? withKpi(tilesOf(projectTiles.data, accountOf(campaign.data))) : []}
        range={range}
        performance={campaign.data?.performance}
        currency={currency}
        kpi={campaignId ? { scope: { kind: "campaign", id: campaignId }, canEdit: editsKpi && !inPreview } : undefined}
      />

      <DailyChart days={days.data ?? []} currency={currency} />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("adSets.title")}
          </h2>
          {allAdSets.length > 0 && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch checked={runningOnly} onCheckedChange={setRunningOnly} />
              {t("campaigns.runningOnly")}
            </label>
          )}
        </div>
        <PerformanceTable
          tableKey={campaign.data?.sourceAccountId
            ? `ad-sets:${campaign.data.channel}:${campaign.data.sourceAccountId}`
            : "ad-sets"}
          inheritFrom="ad-sets"
          heading={t("adSets.one")}
          rows={rows}
          currency={currency}
          extraColumns={resultTypeColumns(offeredTypes)}
          onExpandedChange={setOpenSets}
          onOpen={(adId) => {
            for (const [adSetId, ads] of adsBySet) {
              if (ads.some((ad) => ad.id === adId))
                setPreviewing({ adSetId, adId });
            }
          }}
          empty={adSets.isSuccess ? t(allAdSets.length > 0 ? "adSets.noneRunning" : "adSets.empty") : undefined}
        />
      </div>

      {previewing ? (
        <CreativePreviewDialog
          ads={listedAds(previewing.adSetId)}
          initialAdId={previewing.adId}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
