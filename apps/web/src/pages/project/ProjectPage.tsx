import {
  MetaIntegration,
  useIntegrations,
} from "@/features/meta-integration/index.js";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  EmptyState,
  Skeleton,
  Switch,
  Tabs,
  useAlerts,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { cn, projectDocumentsPath, projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import {
  ProjectHeader,
  useActiveProjectId,
  useProjects,
  useSourceMemory,
  useUpdateProject,
} from "@/entities/project/index.js";
import {
  channelLabel,
  isRunning,
  statusLabel,
  orderedResultTypes,
  resultTypeFiguresOf,
  hasMixedResults,
  totalPerformance,
  useProjectCampaigns,
  useProjectSummary,
} from "@/entities/campaign/index.js";
import { ACTIVE_TASK_COLUMNS, useTasks } from "@/entities/task/index.js";
import { useProjectKpis } from "@/entities/kpi/index.js";
import {
  useChooseSummaryTiles,
  useSummaryTiles,
} from "@/entities/summary-tiles/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { usePreviewMode } from "@/features/preview-mode/index.js";
import { campaignTone } from "./campaignTone.js";
import {
  TaskDialogs,
  type OpenedTask,
} from "@/features/task-management/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useAuth, useModuleEnabled } from "@/features/auth/index.js";
import { useMembers } from "@/entities/membership/index.js";
import { TaskList } from "@/widgets/task-list/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import {
  PerformanceTable,
  resultTypeColumns,
  type PerformanceRow,
} from "@/widgets/performance-table/index.js";
import { ProjectDocuments } from "@/widgets/project-documents/index.js";

const sourceKey = (provider: string, accountId: string) => `${provider}:${accountId}`;

function CampaignTablePlaceholder() {
  return (
    <div
      role="status"
      aria-label={t("campaigns.loading")}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function ProjectPage() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const location = useLocation();
  const { previewing, enter: enterPreview } = usePreviewMode();
  const { range } = usePeriod();
  const projects = useProjects();
  const clients = useClients();
  const summary = useProjectSummary(projectId, range);
  const campaigns = useProjectCampaigns(projectId, range);
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
  const members = useMembers();
  const editsProjectKpi = useCan("update", "kpi");
  const editsProject = useCan("update", "project");
  const updateProject = useUpdateProject();
  const arrangesSummary = useCan("update", "project-summary");
  const { raise } = useAlerts();
  const readsDocuments = useCan("read", "project-document");
  const { documentId } = useParams<{ documentId?: string }>();
  const inDocuments =
    readsDocuments && /\/documents(\/|$)/.test(location.pathname);
  const managesIntegrations = useCan("update", "integration");
  const integrations = useIntegrations(
    projectId ?? "",
    managesIntegrations && projectId != null,
  );
  const source = useSourceMemory((state) => (projectId ? state.sources[projectId] : undefined)) ?? null;
  const rememberSource = useSourceMemory((state) => state.rememberSource);
  const [runningOnly, setRunningOnly] = useState(true);
  useEffect(() => {
    setRunningOnly(true);
  }, [projectId]);

  const inFlight = (tasks.data ?? []).filter((task) =>
    ACTIVE_TASK_COLUMNS.includes(task.column),
  );

  if (projects.isPending) return null;

  const project = projects.data?.find(
    (candidate) => candidate.id === projectId,
  );
  if (!project) return <EmptyState title={t("project.notFound.title")} />;

  const me = members.data?.find(
    (member) => member.userId === user?.id && member.status === "ACTIVE",
  );

  const clientName =
    clients.data?.find((client) => client.id === project.clientId)?.name ?? "";

  const sources = new Map<string, string>();
  for (const connection of integrations.data ?? []) {
    sources.set(
      sourceKey(connection.provider, connection.accountId),
      `${t(`integrations.provider.${connection.provider}`)} · ${connection.accountId}`,
    );
  }
  const all = campaigns.data ?? [];
  for (const campaign of all) {
    if (campaign.sourceAccountId == null) continue;
    const key = sourceKey(campaign.channel, campaign.sourceAccountId);
    if (!sources.has(key)) {
      sources.set(key, `${channelLabel(campaign.channel)} · ${campaign.sourceAccountId}`);
    }
  }
  const sourceKeys = [...sources.keys()];
  const separated = sourceKeys.length > 1;
  const chosen =
    source != null && sources.has(source) ? source : sourceKeys[0];
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

  const rows: PerformanceRow[] = listed.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    note: `${channelLabel(campaign.channel)} · ${statusLabel(campaign.status)}`,
    performance: campaign.performance,
    extra: resultTypeFiguresOf(campaign.performance, offeredTypes),
    mixedResults: hasMixedResults(campaign.performance.resultTypes),
    tone: campaignTone(campaign, projectKpis.data, range),
  }));
  const totals = totalPerformance(listed.map((campaign) => campaign.performance));

  return (
    <div className="flex min-h-0 flex-col gap-6">
      {previewing ? null : (
      <ProjectHeader
        project={project}
        clientName={clientName}
        kpiTrackedPending={updateProject.isPending}
        onKpiTrackedChange={editsProject && editsProjectKpi
          ? (kpiTracked) => updateProject.mutate(
            { id: project.id, body: { kpiTracked } },
            { onError: () => raise(t("project.kpiTrackedFailed")) },
          )
          : undefined}
        onPreview={enterPreview}
      />
      )}

      {readsDocuments && !previewing ? (
        <div className="border-b border-border pb-4">
          <Tabs
            items={[
              { id: "overview", label: t("project.tab.overview") },
              { id: "documents", label: t("project.tab.documents") },
            ]}
            activeId={inDocuments ? "documents" : "overview"}
            onSelect={(id) =>
              navigate(
                `${id === "documents" ? projectDocumentsPath(project.id) : projectPath(project.id)}${location.search}`,
              )
            }
            ariaLabel={t("project.sections")}
          />
        </div>
      ) : null}

      {inDocuments && !previewing ? (
        <ProjectDocuments
          key={project.id}
          projectId={project.id}
          documentId={documentId}
          onOpen={(id) =>
            navigate(`${projectDocumentsPath(project.id, id)}${location.search}`)
          }
          onClose={() =>
            navigate(`${projectDocumentsPath(project.id)}${location.search}`)
          }
        />
      ) : (
        <>
          {previewing ? null : <MetaIntegration key={project.id} projectId={project.id} />}

          <div className={cn("flex flex-wrap items-center justify-between gap-3", !previewing && "border-t pt-2")}>
            <h2 className="text-sm font-semibold text-foreground">
              {t("project.metrics")}
            </h2>
            <PeriodControl />
          </div>

          <PerformanceSummary
            tiles={tiles.data?.tiles ?? []}
            onTilesChange={
              arrangesSummary && tiles.data && !previewing
                ? (next) =>
                    chooseTiles.mutate(next, {
                      onError: () => raise(t("summary.notSaved")),
                    })
                : undefined
            }
            range={range}
            performance={summary.data}
            currency={project.budgetCurrency}
            kpi={{
              scope: { kind: "project", id: project.id },
              canEdit: editsProjectKpi && !previewing,
            }}
          />

          {campaigns.isPending ? (
            <CampaignTablePlaceholder />
          ) : campaigns.isError ? (
            <EmptyState
              title={t("state.error.title")}
              actionLabel={t("state.retry")}
              onAction={() => campaigns.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {(sources.size > 0 || all.length > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {sources.size > 0 && (
                    <Tabs
                      items={[...sources].map(([id, label]) => ({ id, label }))}
                      activeId={chosen}
                      onSelect={(id) => rememberSource(project.id, id)}
                      ariaLabel={t("campaigns.sources")}
                    />
                  )}
                  {all.length > 0 && (
                    <label className="ml-auto flex items-center gap-2 text-sm">
                      <Switch checked={runningOnly} onCheckedChange={setRunningOnly} />
                      {t("campaigns.runningOnly")}
                    </label>
                  )}
                </div>
              )}
              <PerformanceTable
                tableKey="campaigns"
                heading={t("campaigns.one")}
                rows={rows}
                visibleRows={10}
                totals={totals}
                totalsExtra={resultTypeFiguresOf(totals, offeredTypes)}
                totalsMixedResults={hasMixedResults(totals.resultTypes)}
                extraColumns={resultTypeColumns(offeredTypes)}
                currency={project.budgetCurrency}
                empty={
                  campaigns.isSuccess
                    ? t(inAccount.length > 0 ? "campaigns.noneRunning" : "campaigns.empty.title")
                    : undefined
                }
                onOpen={(campaignId) =>
                  navigate(
                    `${projectPath(project.id, campaignId)}${location.search}`,
                  )
                }
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
        </>
      )}

      <TaskDialogs
        opened={opened}
        onClose={() => setOpened({ mode: "closed" })}
      />
    </div>
  );
}
