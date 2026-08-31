import { useForm } from "react-hook-form";
import { useState } from "react";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  useCreateCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
  type CampaignSummary,
} from "@/entities/campaign/index.js";

export interface CampaignFormDialogProps {
  projectId: string;
  campaign?: CampaignSummary;
  onClose: () => void;
  onCreated?: (campaign: CampaignSummary) => void;
  /** A project keeps at least one sheet, so the last one cannot be deleted. */
  canDelete?: boolean;
  onDeleted?: (campaign: CampaignSummary) => void;
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
  projectId, campaign, onClose, onCreated, canDelete = false, onDeleted,
}: CampaignFormDialogProps) {
  const isEdit = campaign != null;
  const [confirming, setConfirming] = useState(false);
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<{ name: string }>({ defaultValues: { name: campaign?.name ?? "" } });
  const create = useCreateCampaign(projectId);
  const update = useUpdateCampaign(projectId);
  const remove = useDeleteCampaign(projectId);

  const onSubmit = handleSubmit(async ({ name }) => {
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
      const message = nameError(err); if (message) setError("name", { message });
    }
  });

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(isEdit ? "campaigns.form.edit.title" : "campaigns.form.new.title")}
          </DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("form.name.label")}
            {...register("name", { required: t("campaigns.form.name.required") })}
            error={errors.name?.message}
            autoFocus
          />
          <DialogFooter className="sm:justify-between">
            {isEdit && canDelete ? (
              <Button variant="destructive" type="button" onClick={() => setConfirming(true)}>
                {t("campaigns.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" type="button" onClick={onClose}>
                {t("action.cancel")}
              </Button>
              <Button variant="default" type="submit" disabled={pending || watch("name").trim() === ""}>
                {t(isEdit ? "action.save" : "action.create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {isEdit && canDelete && (
        <ConfirmDialog
          open={confirming}
          title={t("campaigns.delete.title")}
          description={t("campaigns.delete.body")}
          pending={remove.isPending}
          onConfirm={() => {
            void (async () => {
              await remove.mutateAsync(campaign.id);
              setConfirming(false);
              onDeleted?.(campaign);
              onClose();
            })();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </Dialog>
  );
}
