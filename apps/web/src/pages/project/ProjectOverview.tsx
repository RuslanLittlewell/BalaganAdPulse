import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MetaIntegration, useIntegrations } from "@/features/meta-integration/index.js";
import { EmptyState, Skeleton, Switch, Tabs, useAlerts } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { cn, projectPath, useShareScope } from "@/shared/lib/index.js";
import { useSourceMemory, type Project } from "@/entities/project/index.js";
import {
  channelLabel, isRunning, statusLabel, orderedResultTypes, resultTypeFiguresOf,
  hasMixedResults, totalPerformance, useProjectCampaigns, useProjectSummary, EMPTY_PERFORMANCE,
} from "@/entities/campaign/index.js";
import { ACTIVE_TASK_COLUMNS, useTasks } from "@/entities/task/index.js";
import { useBoardStageCounts } from "@/entities/lead/index.js";
import { kpiInputOf, MANUAL_KPI, useProjectKpis, type KpiAccount } from "@/entities/kpi/index.js";
import { tilesOf, useChooseSummaryTiles, useSummaryTiles } from "@/entities/summary-tiles/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { campaignTone } from "./campaignTone.js";
import { TaskDialogs, type OpenedTask } from "@/features/task-management/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useAuth, useModuleEnabled } from "@/features/auth/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { TaskList } from "@/widgets/task-list/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import {
  CAMPAIGN_LEAD_STAGES, crmStageColumns, crmStageFigures, PerformanceTable,
  resultTypeColumns, type PerformanceRow,
} from "@/widgets/performance-table/index.js";
import { CampaignKpiStrip, type CampaignKpiItem } from "@/widgets/campaign-kpi-strip/index.js";
import { useSeoSites } from "@/entities/seo/index.js";
import { SeoOverview, SeoSummary } from "@/widgets/seo-overview/index.js";

const sourceKey = (provider: string, accountId: string) => `${provider}:${accountId}`;
const siteKey = (siteId: string) => `seo:${siteId}`;

function CampaignTablePlaceholder() {
  return (
    <div
      role="status"
      aria-label={t("campaigns.loading")}
      className="space-y-2 rounded-lg border border-border p-3"
    >
      <Skeleton className="h-6 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function ProjectOverview({ project, previewing }: { project: Project; previewing: boolean }) {
  const projectId = project.id;
  const navigate = useNavigate();
  const location = useLocation();
  const { range } = usePeriod();
  const summary = useProjectSummary(projectId, range);
  const campaigns = useProjectCampaigns(projectId, range);
  const countsLeads = useModuleEnabled("CRM");
  const stageCounts = useBoardStageCounts(projectId ?? undefined, range, { enabled: countsLeads });
  const projectKpis = useProjectKpis(projectId);
  const tiles = useSummaryTiles(
    projectId ? { kind: "project", id: projectId } : undefined,
  );
  const chooseTiles = useChooseSummaryTiles({
    kind: "project",
    id: projectId ?? "",
  });
  const [opened, setOpened] = useState<OpenedTask>({ mode: "closed" });
  const tracksTasks = useModuleEnabled("TASKS");
  const tasks = useTasks({ projectId, enabled: projectId != null && tracksTasks });
  const raisesTasks = useCan("create", "task");
  const { user } = useAuth();
  const shared = useShareScope();
  const members = useMembers({ enabled: shared === null });
  const editsProjectKpi = useCan("update", "kpi");
  const arrangesSummary = useCan("update", "project-summary");
  const { raise } = useAlerts();
  const managesIntegrations = useCan("update", "integration");
  const integrations = useIntegrations(
    projectId ?? "",
    managesIntegrations && projectId != null,
  );
  const seoSites = useSeoSites(projectId);
  const source = useSourceMemory((state) => (projectId ? state.sources[projectId] : undefined)) ?? null;
  const rememberSource = useSourceMemory((state) => state.rememberSource);
  const [runningOnly, setRunningOnly] = useState(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    setRunningOnly(true);
  }, [projectId]);

  const inFlight = (tasks.data ?? []).filter((task) =>
    ACTIVE_TASK_COLUMNS.includes(task.column),
  );

  const me = members.data?.find(
    (member) => member.userId === user?.id && member.status === "ACTIVE",
  );

  const sources = new Map<string, { label: string; account: KpiAccount }>();
  const addSource = (account: KpiAccount, label: string) => {
    const key = sourceKey(account.channel, account.accountId);
    if (!sources.has(key)) sources.set(key, { label, account });
  };
  for (const connection of integrations.data ?? []) {
    addSource(
      { channel: connection.provider, accountId: connection.accountId },
      `${t(`integrations.provider.${connection.provider}`)} · ${connection.accountId}`,
    );
  }
  const all = campaigns.data ?? [];
  for (const campaign of all) {
    if (campaign.sourceAccountId == null) continue;
    addSource(
      { channel: campaign.channel, accountId: campaign.sourceAccountId },
      `${channelLabel(campaign.channel)} · ${campaign.sourceAccountId}`,
    );
  }
  for (const { account } of projectKpis.data ?? []) {
    if (account) addSource(account, `${channelLabel(account.channel)} · ${account.accountId}`);
  }
  const sourceKeys = [...sources.keys()];
  const sites = (seoSites.data ?? []).map((site) => ({ key: siteKey(site.id), label: `${t("seo.tab")} · ${site.label}`, site }));
  const tabKeys = [...sourceKeys, ...sites.map((entry) => entry.key)];
  const separated = sourceKeys.length > 1;
  const chosen =
    source != null && tabKeys.includes(source) ? source : tabKeys[0];
  const chosenSite = sites.find((entry) => entry.key === chosen)?.site;
  const chosenAccount = separated && chosen && !chosenSite ? sources.get(chosen)?.account : undefined;
  const inAccount = all.filter(
    (campaign) =>
      !separated ||
      (campaign.sourceAccountId != null &&
        sourceKey(campaign.channel, campaign.sourceAccountId) === chosen),
  );
  const running = inAccount.filter((campaign) => isRunning(campaign.status));
  const listed = runningOnly
    ? running
    : [...running, ...inAccount.filter((campaign) => !isRunning(campaign.status))];

  const offeredTypes = orderedResultTypes(all.flatMap((campaign) => campaign.resultTypes));

  const countsByCampaign = new Map(
    (stageCounts.data?.campaigns ?? []).map((counts) => [counts.campaignId, counts]),
  );
  const stageFiguresOf = (campaignIds: readonly string[]) =>
    countsLeads
      ? crmStageFigures(campaignIds.map((id) => countsByCampaign.get(id)), CAMPAIGN_LEAD_STAGES)
      : {};

  const toneOf = (campaign: (typeof listed)[number]) => campaignTone(campaign, range);
  const rows: PerformanceRow[] = listed.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    note: `${channelLabel(campaign.channel)} · ${statusLabel(campaign.status)}`,
    performance: campaign.performance,
    extra: {
      ...resultTypeFiguresOf(campaign.performance, offeredTypes),
      ...stageFiguresOf([campaign.id]),
    },
    mixedResults: hasMixedResults(campaign.performance.resultTypes),
    tone: toneOf(campaign),
  }));
  const withKpi: CampaignKpiItem[] = listed.flatMap((campaign) => {
    const kpi = kpiInputOf(campaign.kpi);
    return kpi && kpi.metric !== MANUAL_KPI
      ? [{ id: campaign.id, name: campaign.name, kpi, performance: campaign.performance, tone: toneOf(campaign) }]
      : [];
  });
  const openCampaign = (campaignId: string) =>
    navigate(`${projectPath(project.id, campaignId)}${location.search}`);
  const totals = totalPerformance(listed.map((campaign) => campaign.performance));
  const accountTotals = (account: KpiAccount) => totalPerformance(all
    .filter((campaign) => campaign.channel === account.channel && campaign.sourceAccountId === account.accountId)
    .map((campaign) => campaign.performance));
  const onlyAccount = sourceKeys.length === 1 ? sources.get(sourceKeys[0]!)?.account ?? null : null;

  const sourceTabs = tabKeys.length > 0 ? (
    <Tabs
      items={[
        ...[...sources].map(([id, { label }]) => ({ id, label })),
        ...sites.map((entry) => ({ id: entry.key, label: entry.label })),
      ]}
      activeId={chosen}
      onSelect={(id) => rememberSource(project.id, id)}
      ariaLabel={t("campaigns.sources")}
      className="w-fit"
    />
  ) : null;

  return (
    <>
          {previewing ? null : <MetaIntegration key={project.id} projectId={project.id} />}

          <div className={cn("flex flex-wrap items-center justify-between gap-2", !previewing && "border-t pt-2")}>
            <h2 className="text-sm font-semibold text-foreground">
              {t("project.metrics")}
            </h2>
            <PeriodControl />
          </div>

          {chosenSite ? (
            <SeoSummary key={chosenSite.id} projectId={project.id} siteId={chosenSite.id} range={range} />
          ) : (
          <PerformanceSummary
            tiles={tiles.data ? tilesOf(tiles.data, chosenAccount) : []}
            onTilesChange={
              arrangesSummary && tiles.data && !previewing
                ? (next) =>
                    chooseTiles.mutate({ tiles: next, account: chosenAccount ?? null }, {
                      onError: () => raise(t("summary.notSaved")),
                    })
                : undefined
            }
            range={range}
            performance={chosenAccount ? campaigns.data && accountTotals(chosenAccount) : summary.data}
            currency={project.budgetCurrency}
            kpi={{
              scope: { kind: "project", id: project.id },
              canEdit: editsProjectKpi && !previewing,
              part: chosenAccount ? { kind: "account", account: chosenAccount } : { kind: "all", account: onlyAccount },
              projectFigures: summary.data ?? EMPTY_PERFORMANCE,
            }}
          />
          )}

          {chosenSite ? (
            <div className="flex flex-col gap-2">
              {sourceTabs}
              <SeoOverview
                key={chosenSite.id}
                projectId={project.id}
                site={chosenSite}
                range={range}
                canCheck={managesIntegrations && !previewing}
              />
            </div>
          ) : campaigns.isPending ? (
            <CampaignTablePlaceholder />
          ) : campaigns.isError ? (
            <EmptyState
              title={t("state.error.title")}
              actionLabel={t("state.retry")}
              onAction={() => campaigns.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {(tabKeys.length > 0 || all.length > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {sourceTabs}
                  {all.length > 0 && (
                    <label className="ml-auto flex items-center gap-2 text-sm">
                      <Switch checked={runningOnly} onCheckedChange={setRunningOnly} />
                      {t("campaigns.runningOnly")}
                    </label>
                  )}
                </div>
              )}

              <CampaignKpiStrip
                campaigns={withKpi}
                range={range}
                highlightedId={highlighted ?? undefined}
                onHighlight={setHighlighted}
                onOpen={openCampaign}
              />
              <PerformanceTable
                tableKey={chosen ? `campaigns:${chosen}` : "campaigns"}
                inheritFrom="campaigns"
                highlightedId={highlighted ?? undefined}
                heading={t("campaigns.one")}
                rows={rows}
                visibleRows={10}
                totals={totals}
                totalsExtra={{
                  ...resultTypeFiguresOf(totals, offeredTypes),
                  ...stageFiguresOf(listed.map((campaign) => campaign.id)),
                }}
                totalsMixedResults={hasMixedResults(totals.resultTypes)}
                extraColumns={countsLeads
                  ? [...resultTypeColumns(offeredTypes), ...crmStageColumns(CAMPAIGN_LEAD_STAGES)]
                  : resultTypeColumns(offeredTypes)}
                currency={project.budgetCurrency}
                empty={
                  campaigns.isSuccess
                    ? t(inAccount.length > 0 ? "campaigns.noneRunning" : "campaigns.empty.title")
                    : undefined
                }
                onOpen={openCampaign}
              />
            </div>
          )}

          {tracksTasks && !previewing && (
            <TaskList
              title={t("tasks.inFlight.title")}
              tasks={inFlight}
              empty={t("tasks.inFlight.empty")}
              onOpen={(task) => setOpened({ mode: "open", task })}
              onCreate={
                raisesTasks
                  ? () =>
                      setOpened({
                        mode: "create",
                        projectId: project.id,
                        participantIds: me ? [me.id] : undefined,
                      })
                  : undefined
              }
            />
          )}
      <TaskDialogs opened={opened} onClose={() => setOpened({ mode: "closed" })} />
    </>
  );
}
