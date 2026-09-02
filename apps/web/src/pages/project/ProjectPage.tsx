import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HistoryIcon } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import { ProjectHeader, useActiveProjectId, useProjects } from "@/entities/project/index.js";
import {
  channelLabel, performanceTone, statusLabel, useProjectCampaigns, useProjectSummary,
} from "@/entities/campaign/index.js";
import { ACTIVE_TASK_COLUMNS, useTasks, type Task } from "@/entities/task/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { TaskPreviewDialog } from "@/features/task-management/index.js";
import { Can } from "@/features/permissions/index.js";
import { TaskList } from "@/widgets/task-list/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import type { AuditEventFilters } from "@/entities/audit-event/index.js";

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

/** One project: what it spent over the period, and the campaigns it spent it on. */
export function ProjectPage() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();
  const { range } = usePeriod();
  const projects = useProjects();
  const clients = useClients();
  const summary = useProjectSummary(projectId, range);
  const campaigns = useProjectCampaigns(projectId, range);
  const [activityFilters, setActivityFilters] = useState<AuditEventFilters | null>(null);
  const [reading, setReading] = useState<Task | null>(null);
  // Held back until the address has been read: an unscoped listing here
  // would fetch every task in the organization.
  const tasks = useTasks({ projectId, enabled: projectId != null });

  /* Filtered here rather than asked for: this is the listing the board already
     fetches, so reusing it costs a cache hit, and a stage parameter would split
     one answer into two that differ by a predicate the client can apply. */
  const inFlight = (tasks.data ?? [])
    .filter((task) => ACTIVE_TASK_COLUMNS.includes(task.column));

  if (projects.isPending) return null;

  const project = projects.data?.find((candidate) => candidate.id === projectId);
  if (!project) return <EmptyState title={t("project.notFound.title")} />;

  const clientName = clients.data?.find((client) => client.id === project.clientId)?.name ?? "";

  const rows: PerformanceRow[] = (campaigns.data ?? []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    note: `${channelLabel(campaign.channel)} · ${statusLabel(campaign.status)}`,
    performance: campaign.performance,
    tone: performanceTone(campaign.performance),
  }));

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <ProjectHeader project={project} clientName={clientName} actions={
        <Can action="read" resource="audit">
          <Button variant="outline" size="sm" onClick={() => setActivityFilters({ projectId: project.id })}>
            <HistoryIcon /> {t("activity.title")}
          </Button>
        </Can>
      } />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t("campaigns.title")}</h2>
        <PeriodControl />
      </div>

      <PerformanceSummary performance={summary.data} />

      {campaigns.isPending ? (
        <CampaignTablePlaceholder />
      ) : campaigns.isError ? (
        <EmptyState
          title={t("state.error.title")}
          action={
            <Button variant="outline" size="sm" onClick={() => campaigns.refetch()}>
              {t("state.retry")}
            </Button>
          }
        />
      ) : (
        <PerformanceTable
          heading={t("campaigns.one")}
          rows={rows}
          totals={summary.data}
          empty={campaigns.isSuccess ? t("campaigns.empty.title") : undefined}
          onOpen={(campaignId) => navigate(projectPath(project.id, campaignId))}
        />
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
        onOpenChange={(open) => { if (!open) setActivityFilters(null); }}
      />
    </div>
  );
}
