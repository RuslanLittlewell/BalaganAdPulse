import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../../components/EmptyState/EmptyState.js";
import { Dialog } from "../../../components/Dialog/Dialog.js";
import { Button } from "../../../components/Button/Button.js";
import { t } from "../../../i18n/en.js";
import { useClients, useDeleteClient } from "../data/queries.js";
import { ClientHeader } from "../components/ClientHeader/ClientHeader.js";
import { ClientFormDialog } from "../components/ClientFormDialog/ClientFormDialog.js";
import { useCampaigns, useDeleteCampaign } from "../../campaigns/data/queries.js";
import { CampaignTabs } from "../../campaigns/components/CampaignTabs/CampaignTabs.js";
import { CampaignSheet } from "../../campaigns/components/CampaignSheet/CampaignSheet.js";
import { CampaignFormDialog } from "../../campaigns/components/CampaignFormDialog/CampaignFormDialog.js";

export function ClientPage() {
  const { clientId, campaignId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const campaigns = useCampaigns(clientId);
  const remove = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [renamingSheetId, setRenamingSheetId] = useState<string | undefined>(undefined);
  const removeSheet = useDeleteCampaign(clientId ?? "");
  const [deletingSheetId, setDeletingSheetId] = useState<string | undefined>(undefined);

  const firstCampaignId = campaigns.data?.[0]?.id;
  const renamingSheet = campaigns.data?.find((campaign) => campaign.id === renamingSheetId);
  const deletingSheet = campaigns.data?.find((campaign) => campaign.id === deletingSheetId);
  useEffect(() => {
    if (campaignId == null && firstCampaignId != null) {
      navigate(`/clients/${clientId}/campaigns/${firstCampaignId}`, { replace: true });
    }
  }, [campaignId, firstCampaignId, clientId, navigate]);

  if (clients.isPending) return null;

  const client = clients.data?.find((c) => c.id === clientId);
  if (!client) {
    return <EmptyState title={t("clients.notFound.title")} description={t("clients.notFound.description")} />;
  }

  async function onConfirmDelete() {
    await remove.mutateAsync(client!.id);
    setConfirming(false);
    navigate("/");
  }

  async function onConfirmDeleteSheet() {
    const all = campaigns.data ?? [];
    const index = all.findIndex((campaign) => campaign.id === deletingSheetId);
    const neighbour = all[index - 1] ?? all[index + 1];
    await removeSheet.mutateAsync(deletingSheetId!);
    setDeletingSheetId(undefined);
    if (neighbour != null) navigate(`/clients/${clientId}/campaigns/${neighbour.id}`, { replace: true });
  }

  return (
    <>
      <ClientHeader client={client} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />

      {campaigns.isError && (
        <EmptyState
          title={t("state.error.title")}
          action={
            <Button variant="ghost" size="sm" onClick={() => campaigns.refetch()}>
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
            <Button variant="primary" size="sm" onClick={() => setCreatingSheet(true)}>
              {t("campaigns.empty.action")}
            </Button>
          }
        />
      )}

      {campaigns.isSuccess && campaigns.data.length > 0 && (
        <>
          <CampaignTabs
            clientId={client.id}
            campaigns={campaigns.data}
            activeCampaignId={campaignId}
            onNew={() => setCreatingSheet(true)}
            onRename={(id) => setRenamingSheetId(id)}
            onDelete={(id) => setDeletingSheetId(id)}
          />
          {campaignId != null && <CampaignSheet campaignId={campaignId} />}
        </>
      )}

      {editing && <ClientFormDialog client={client} onClose={() => setEditing(false)} />}

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)} title={t("client.delete.title")}>
          <p>{t("client.delete.body")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={onConfirmDelete} disabled={remove.isPending}>
              {t("action.delete")}
            </Button>
          </div>
        </Dialog>
      )}

      {creatingSheet && (
        <CampaignFormDialog
          clientId={client.id}
          onClose={() => setCreatingSheet(false)}
          onCreated={(campaign) => navigate(`/clients/${client.id}/campaigns/${campaign.id}`)}
        />
      )}

      {renamingSheet != null && (
        <CampaignFormDialog
          clientId={client.id}
          campaign={renamingSheet}
          onClose={() => setRenamingSheetId(undefined)}
        />
      )}

      {deletingSheet != null && (
        <Dialog open onClose={() => setDeletingSheetId(undefined)} title={t("campaigns.delete.title")}>
          <p>{t("campaigns.delete.body")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setDeletingSheetId(undefined)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={onConfirmDeleteSheet} disabled={removeSheet.isPending}>
              {t("action.delete")}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
