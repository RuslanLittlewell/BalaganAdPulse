import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const NONE = "__none__";

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
  projectId: values.projectId === NONE ? null : values.projectId,
  campaignId: values.campaignId === NONE ? null : values.campaignId,
});

export function LeadFormDialog({ boardKey, capabilities, lead, onClose }: LeadFormDialogProps) {
  const create = useCreateLead(boardKey);
  const update = useUpdateLead(boardKey);
  const move = useMoveLead(boardKey);
  const remove = useDeleteLead(boardKey);
  const { raise } = useAlerts();
  const [confirming, setConfirming] = useState(false);

  const editable = lead ? capabilities.update : capabilities.create;
  const { control, handleSubmit, register, setValue, watch, formState: { errors } } =
    useForm<FormValues>({ defaultValues: valuesOf(lead) });

  const projectId = watch("projectId");

  const { data: projects } = useProjects(boardKey === AGENCY_BOARD ? undefined : boardKey);
  const { data: campaigns } = useCampaignReferences(projectId === NONE ? undefined : projectId);

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
                <Controller
                  control={control}
                  name="projectId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                      <SelectTrigger id="lead-project" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("crm.form.noProject")}</SelectItem>
                        {(projects ?? []).map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="lead-campaign">{t("crm.form.campaign")}</Label>
                <Controller
                  control={control}
                  name="campaignId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!editable || projectId === NONE}
                    >
                      <SelectTrigger id="lead-campaign" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("crm.form.noCampaign")}</SelectItem>
                        {(campaigns ?? []).map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="lead-stage">{t("crm.form.stage")}</Label>
              <Controller
                control={control}
                name="stage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                    <SelectTrigger id="lead-stage" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STAGES.map((option) => (
                        <SelectItem key={option} value={option}>{t(`crm.stage.${option}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
