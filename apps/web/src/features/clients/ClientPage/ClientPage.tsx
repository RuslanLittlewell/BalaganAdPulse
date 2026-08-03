import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../../components/EmptyState/EmptyState.js";
import { Dialog } from "../../../components/Dialog/Dialog.js";
import { Button } from "../../../components/Button/Button.js";
import { t } from "../../../i18n/en.js";
import { useClients, useDeleteClient } from "../data/queries.js";
import { ClientHeader } from "../components/ClientHeader/ClientHeader.js";
import { ClientFormDialog } from "../components/ClientFormDialog/ClientFormDialog.js";

export function ClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const remove = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  return (
    <>
      <ClientHeader client={client} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />

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
    </>
  );
}
