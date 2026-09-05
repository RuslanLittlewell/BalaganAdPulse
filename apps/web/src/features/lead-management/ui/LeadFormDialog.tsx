import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useCampaignReferences } from "@/entities/campaign/index.js";
import { useProjects } from "@/entities/project/index.js";
import {
  AGENCY_BOARD,
  LEAD_STAGES,
  useCreateLead,
  useDeleteLead,
  useMoveLead,
  useUpdateLead,
  type BoardCapabilities,
  type Lead,
  type LeadInput,
  type LeadStage,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  TextField,
  useAlerts,
} from "@/shared/ui/index.js";

export interface LeadFormDialogProps {
  boardKey: string;
  capabilities: BoardCapabilities;
  lead?: Lead;
  onClose: () => void;
}

interface FormValues {
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  source: string;
  notes: string;
  projectId: string;
  campaignId: string;
  stage: LeadStage;
}

const TEXT_FIELDS = ["company", "phone", "email", "website", "source"] as const;

const NONE = "";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent pl-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const valuesOf = (lead?: Lead): FormValues => ({
  name: lead?.name ?? "",
  company: lead?.company ?? "",
  phone: lead?.phone ?? "",
  email: lead?.email ?? "",
  website: lead?.website ?? "",
  source: lead?.source ?? "",
  notes: lead?.notes ?? "",
  projectId: lead?.projectId ?? NONE,
  campaignId: lead?.campaignId ?? NONE,
  stage: lead?.stage ?? "NEW",
});

const messageOf = (error: unknown) =>
  error instanceof ApiError && error.status < 500 ? error.message : t("crm.form.saveFailed");

const bodyOf = (values: FormValues): LeadInput => ({
  name: values.name.trim(),
  company: values.company.trim() || null,
  phone: values.phone.trim() || null,
  email: values.email.trim() || null,
  website: values.website.trim() || null,
  source: values.source.trim() || null,
  notes: values.notes.trim() || null,
  projectId: values.projectId || null,
  campaignId: values.campaignId || null,
});

export function LeadFormDialog({ boardKey, capabilities, lead, onClose }: LeadFormDialogProps) {
  const create = useCreateLead(boardKey);
  const update = useUpdateLead(boardKey);
  const move = useMoveLead(boardKey);
  const remove = useDeleteLead(boardKey);
  const { raise } = useAlerts();
  const [confirming, setConfirming] = useState(false);

  const editable = lead ? capabilities.update : capabilities.create;
  const { handleSubmit, register, setValue, watch, formState: { errors } } =
    useForm<FormValues>({ defaultValues: valuesOf(lead) });

  const stage = watch("stage");
  const projectId = watch("projectId");
  const campaignId = watch("campaignId");

  const { data: projects } = useProjects(boardKey === AGENCY_BOARD ? undefined : boardKey);
  const { data: campaigns } = useCampaignReferences(projectId || undefined);

  const chosenProject = useRef(projectId);
  useEffect(() => {
    if (chosenProject.current === projectId) return;
    chosenProject.current = projectId;
    setValue("campaignId", NONE);
  }, [projectId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!lead) {
        await create.mutateAsync({ ...bodyOf(values), stage: values.stage });
      } else {
        await update.mutateAsync({ id: lead.id, body: bodyOf(values) });
        if (values.stage !== lead.stage) {
          await move.mutateAsync({ id: lead.id, body: { stage: values.stage, position: 2147483647 } });
        }
      }
      onClose();
    } catch (error) {
      raise(messageOf(error));
    }
  });

  async function confirmDelete() {
    if (!lead) return;
    try {
      await remove.mutateAsync(lead.id);
      onClose();
    } catch (error) {
      setConfirming(false);
      raise(messageOf(error));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={
          "flex h-[min(760px,calc(100vh-2rem))] w-[min(600px,calc(100vw-2rem))] " +
          "min-w-[min(600px,calc(100vw-2rem))] flex-col"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{lead ? t("crm.form.edit") : t("crm.create")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <TextField
              label={t("crm.form.name")}
              error={errors.name?.message}
              disabled={!editable}
              {...register("name", { required: t("crm.form.nameRequired") })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <TextField
                  key={field}
                  label={t(`crm.form.${field}`)}
                  disabled={!editable}
                  {...register(field)}
                />
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="lead-project">{t("crm.form.project")}</Label>
                <select
                  id="lead-project"
                  className={SELECT_CLASS}
                  disabled={!editable}
                  value={projectId}
                  {...register("projectId")}
                >
                  <option value={NONE}>{t("crm.form.noProject")}</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="lead-campaign">{t("crm.form.campaign")}</Label>
                <select
                  id="lead-campaign"
                  className={SELECT_CLASS}
                  disabled={!editable || !projectId}
                  value={campaignId}
                  {...register("campaignId")}
                >
                  <option value={NONE}>{t("crm.form.noCampaign")}</option>
                  {(campaigns ?? []).map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="lead-stage">{t("crm.form.stage")}</Label>
              <select
                id="lead-stage"
                className={SELECT_CLASS}
                disabled={!editable}
                value={stage}
                {...register("stage")}
              >
                {LEAD_STAGES.map((option) => (
                  <option key={option} value={option}>{t(`crm.stage.${option}`)}</option>
                ))}
              </select>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <Label htmlFor="lead-notes">{t("crm.form.notes")}</Label>
              <textarea
                id="lead-notes"
                className="min-h-32 flex-1 rounded-md border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!editable}
                {...register("notes")}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border pt-4">
            {lead && capabilities.delete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
                {t("crm.delete")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            {editable ? (
              <Button type="submit">{lead ? t("crm.form.save") : t("crm.form.create")}</Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>

      {confirming && lead ? (
        <ConfirmDialog
          open
          title={t("crm.deleteConfirm")}
          description={t("crm.deleteQuestion")}
          confirmLabel={t("crm.deleteConfirm")}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Dialog>
  );
}
