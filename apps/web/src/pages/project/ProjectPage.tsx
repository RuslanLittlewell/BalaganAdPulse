import {
  MetaIntegration,
  useIntegrations,
} from "@/features/meta-integration/index.js";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState, Skeleton, Switch, Tabs } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import {
  ProjectHeader,
  useActiveProjectId,
  useProjects,
} from "@/entities/project/index.js";
import {
  channelLabel,
  isRunning,
  statusLabel,
  totalPerformance,
  useProjectCampaigns,
  useProjectSummary,
} from "@/entities/campaign/index.js";
import {
  ACTIVE_TASK_COLUMNS,
  useTasks,
  type Task,
} from "@/entities/task/index.js";
import { useKpi } from "@/entities/kpi/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { campaignTone } from "./campaignTone.js";
import { TaskPreviewDialog } from "@/features/task-management/index.js";
import { useCan } from "@/features/permissions/index.js";
import { TaskList } from "@/widgets/task-list/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import {
  PerformanceTable,
  type PerformanceRow,
} from "@/widgets/performance-table/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import type { AuditEventFilters } from "@/entities/audit-event/index.js";

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
  const { range } = usePeriod();
  const projects = useProjects();
  const clients = useClients();
  const summary = useProjectSummary(projectId, range);
  const campaigns = useProjectCampaigns(projectId, range);
  const projectKpi = useKpi(
    projectId ? { kind: "project", id: projectId } : undefined,
  );
  const [activityFilters, setActivityFilters] =
    useState<AuditEventFilters | null>(null);
  const [reading, setReading] = useState<Task | null>(null);
  const tasks = useTasks({ projectId, enabled: projectId != null });
  const editsProjectKpi = useCan("update", "kpi");
  const readsActivity = useCan("read", "audit");
  const managesIntegrations = useCan("update", "integration");
  const integrations = useIntegrations(
    projectId ?? "",
    managesIntegrations && projectId != null,
  );
  const [source, setSource] = useState<string | null>(null);
  const [runningOnly, setRunningOnly] = useState(true);
  useEffect(() => {
    setSource(null);
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

  const rows: PerformanceRow[] = listed.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    note: `${channelLabel(campaign.channel)} · ${statusLabel(campaign.status)}`,
    performance: campaign.performance,
    tone: campaignTone(campaign, projectKpi.data, range),
  }));

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <ProjectHeader
        project={project}
        clientName={clientName}
        onShowActivity={
          readsActivity
            ? () => setActivityFilters({ projectId: project.id })
            : undefined
        }
      />

      <MetaIntegration key={project.id} projectId={project.id} />

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-2">
        <PeriodControl />
      </div>

      <PerformanceSummary
        screen="project"
        range={range}
        performance={summary.data}
        currency={project.budgetCurrency}
        kpi={{
          scope: { kind: "project", id: project.id },
          canEdit: editsProjectKpi,
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
                  onSelect={setSource}
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
            totals={totalPerformance(listed.map((campaign) => campaign.performance))}
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

      <TaskList
        title={t("tasks.inFlight.title")}
        tasks={inFlight}
        empty={t("tasks.inFlight.empty")}
        onOpen={setReading}
      />

      {reading ? (
        <TaskPreviewDialog task={reading} onClose={() => setReading(null)} />
      ) : null}

      <ActivityLogModal
        open={activityFilters != null}
        filters={activityFilters ?? {}}
        onOpenChange={(open) => {
          if (!open) setActivityFilters(null);
        }}
      />
    </div>
  );
}
