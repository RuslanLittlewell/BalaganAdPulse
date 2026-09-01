import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HistoryIcon } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import { ProjectHeader, useActiveProjectId, useProjects } from "@/entities/project/index.js";
import {
  channelLabel, performanceTone, statusLabel, useProjectCampaigns, useProjectSummary,
} from "@/entities/campaign/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { Can } from "@/features/permissions/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import type { AuditEventFilters } from "@/entities/audit-event/index.js";

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

      {campaigns.isError ? (
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

      <ActivityLogModal
        open={activityFilters != null}
        filters={activityFilters ?? {}}
        onOpenChange={(open) => { if (!open) setActivityFilters(null); }}
      />
    </div>
  );
}
