import { useState, type FormEvent } from "react";
import { Dialog } from "../../../../components/Dialog/Dialog.js";
import { TextField } from "../../../../components/TextField/TextField.js";
import { Button } from "../../../../components/Button/Button.js";
import { ApiError } from "../../../../lib/http.js";
import { t } from "../../../../i18n/en.js";
import { useCreateCampaign, useUpdateCampaign } from "../../data/queries.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignFormDialogProps {
  clientId: string;
  campaign?: CampaignSummary;
  onClose: () => void;
  onCreated?: (campaign: CampaignSummary) => void;
}

/** Pulls the server's message for the `name` field out of a 400 envelope. */
function nameError(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  for (const issue of error.details) {
    const path = (issue as { path?: unknown[] }).path;
    const message = (issue as { message?: string }).message;
    if (Array.isArray(path) && path[0] === "name" && message) return message;
  }
  return undefined;
}

export function CampaignFormDialog({
  clientId, campaign, onClose, onCreated,
}: CampaignFormDialogProps) {
  const isEdit = campaign != null;
  const [name, setName] = useState(campaign?.name ?? "");
  const [error, setError] = useState<string | undefined>(undefined);
  const create = useCreateCampaign(clientId);
  const update = useUpdateCampaign(clientId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body = { name: name.trim() };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: campaign.id, body });
      } else {
        // Kept on its own line: `onCreated?.(await …)` would short-circuit and
        // never create the sheet when no `onCreated` is supplied.
        const created = await create.mutateAsync(body);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(nameError(err));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(isEdit ? "campaigns.form.edit.title" : "campaigns.form.new.title")}
    >
      <form
        noValidate
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <TextField
          label={t("form.name.label")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending || name.trim() === ""}>
            {t(isEdit ? "action.save" : "action.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
