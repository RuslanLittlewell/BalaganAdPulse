import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { useClients } from "@/entities/client/index.js";
import {
  ProjectHeader,
  useActiveCampaignId,
  useActiveProjectId,
  useProjects,
} from "@/entities/project/index.js";
import { useCampaigns, type CampaignSummary } from "@/entities/campaign/index.js";
import { CampaignFormDialog, CampaignTabs } from "@/features/campaign-management/index.js";
import { CampaignSheet } from "@/widgets/campaign-sheet/index.js";

export function ProjectPage() {
  const projectId = useActiveProjectId();
  const campaignId = useActiveCampaignId();
  const navigate = useNavigate();
  const projects = useProjects();
  const clients = useClients();
  const campaigns = useCampaigns(projectId);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | undefined>(undefined);

  const firstCampaignId = campaigns.data?.[0]?.id;
  /* The address catches up through the redirect below, but the interface does
   * not have to wait for it: without this the tabs render with nothing selected
   * for as long as the sheet list takes to load, then flip. */
  const activeCampaignId = campaignId ?? firstCampaignId;
  const editingSheet = campaigns.data?.find((campaign) => campaign.id === editingSheetId);

  useEffect(() => {
    if (campaignId == null && firstCampaignId != null && projectId != null) {
      navigate(projectPath(projectId, firstCampaignId), { replace: true });
    }
  }, [campaignId, firstCampaignId, projectId, navigate]);

  if (projects.isPending) return null;

  const project = projects.data?.find((candidate) => candidate.id === projectId);
  if (!project) return <EmptyState title={t("project.notFound.title")} />;

  const clientName = clients.data?.find((client) => client.id === project.clientId)?.name ?? "";


  /** Opens the sheet next to the one just deleted, so the route never points
   *  at a sheet that is gone. */
  function afterSheetDeleted(deleted: CampaignSummary) {
    const all = campaigns.data ?? [];
    const index = all.findIndex((campaign) => campaign.id === deleted.id);
    const neighbour = all[index - 1] ?? all[index + 1];
    setEditingSheetId(undefined);
    if (neighbour != null) navigate(projectPath(project!.id, neighbour.id), { replace: true });
  }

  return (
    <>
      <ProjectHeader project={project} clientName={clientName} />

      {campaigns.isError && (
        <EmptyState
          title={t("state.error.title")}
          action={
            <Button variant="outline" size="sm" onClick={() => campaigns.refetch()}>
              {t("state.retry")}
            </Button>
          }
        />
      )}

      {campaigns.isSuccess && campaigns.data.length === 0 && (
        <EmptyState
          title={t("campaigns.empty.title")}
          description={t("campaigns.empty.description")}
          action={
            <Button size="sm" onClick={() => setCreatingSheet(true)}>
              {t("campaigns.empty.action")}
            </Button>
          }
        />
      )}

      {campaigns.isSuccess && campaigns.data.length > 0 && (
        <>
          <CampaignTabs
            projectId={project.id}
            campaigns={campaigns.data}
            activeCampaignId={activeCampaignId}
            onNew={() => setCreatingSheet(true)}
            onRename={(id) => setEditingSheetId(id)}
          />
          {activeCampaignId != null && <CampaignSheet campaignId={activeCampaignId} />}
        </>
      )}

      {creatingSheet && (
        <CampaignFormDialog
          projectId={project.id}
          onClose={() => setCreatingSheet(false)}
          onCreated={(campaign) => navigate(projectPath(project.id, campaign.id))}
        />
      )}

      {editingSheet != null && (
        <CampaignFormDialog
          projectId={project.id}
          campaign={editingSheet}
          canDelete={(campaigns.data ?? []).length > 1}
          onDeleted={afterSheetDeleted}
          onClose={() => setEditingSheetId(undefined)}
        />
      )}

    </>
  );
}
