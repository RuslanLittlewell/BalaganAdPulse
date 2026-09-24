import { useMemo, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useProjects } from "@/entities/project/index.js";
import { MemberAvatar, useClientMembers } from "@/entities/membership/index.js";
import {
  FIXED_LEAD_COLUMNS,
  leadColumnLabel,
  useCreateLead,
  useDeleteLead,
  useLeadColumns,
  useLeads,
  useMoveLead,
  useUpdateLead,
  type BoardCapabilities,
  type Lead,
  type LeadAd,
} from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { ApiError, cn } from "@/shared/lib/index.js";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  useAlerts,
} from "@/shared/ui/index.js";
import { bodyOf, isAmount, NONE, valuesOf, type CardValues } from "../lib/card-values.js";
import { LeadActivityTab } from "./LeadActivityTab.js";
import { LeadFilesTab } from "./LeadFilesTab.js";
import { LeadSourceSection } from "./LeadSourceSection.js";
import { LeadTags } from "./LeadTags.js";

export interface LeadCardProps {
  boardKey: string;
  capabilities: BoardCapabilities;
  lead?: Lead;
  onClose: () => void;
  onPreviewCreative?: (ad: LeadAd) => void;
}

type Tab = "activity" | "files" | "info";

type TextField = "company" | "service" | "phone" | "telegram" | "messenger" | "email" | "website" | "source";

const LAST_POSITION = 2147483647;

const INPUT = "h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none " +
  "placeholder:text-muted-foreground/60 hover:border-input focus-visible:border-ring disabled:cursor-not-allowed disabled:hover:border-transparent";

const messageOf = (error: unknown) =>
  error instanceof ApiError && error.status < 500 ? error.message : t("crm.form.saveFailed");

function Row({ id, label, children }: { id: string; label: MessageKey; children: ReactNode }) {
  return (
    <li data-field={t(label)} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 border-b border-border py-1.5">
      <Label id={`${id}-label`} htmlFor={id}>{t(label)}</Label>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

export function LeadCard({ boardKey, capabilities, lead: opened, onClose, onPreviewCreative }: LeadCardProps) {
  const [lead, setLead] = useState(opened);
  const create = useCreateLead(boardKey);
  const update = useUpdateLead(boardKey);
  const move = useMoveLead(boardKey);
  const remove = useDeleteLead(boardKey);
  const { raise } = useAlerts();
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState<Tab>("activity");

  const editable = lead ? capabilities.update : capabilities.create;
  const { control, handleSubmit, register, reset, formState: { errors, isSubmitting } } =
    useForm<CardValues>({ defaultValues: valuesOf(opened) });

  const { data: projects } = useProjects();
  const boardProject = projects?.find((project) => project.id === boardKey);
  const { data: clientMembers } = useClientMembers(boardProject?.clientId ?? lead?.project.clientId);
  const assignees = clientMembers?.filter((member) => member.status === "ACTIVE") ?? [];
  const { data: columns } = useLeadColumns(boardKey);
  const { data: boardLeads } = useLeads(boardKey);
  const suggestions = useMemo(
    () => [...new Set((boardLeads ?? []).flatMap((candidate) => candidate.tags ?? []))].sort((a, b) => a.localeCompare(b, "ru")),
    [boardLeads],
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!lead) {
        const created = await create.mutateAsync({ ...bodyOf(values), stage: values.stage });
        setLead(created);
        reset(valuesOf(created));
        raise(t("crm.created"), "success");
        return;
      }
      await update.mutateAsync({ id: lead.id, body: bodyOf(values) });
      if (values.stage !== lead.stage) {
        await move.mutateAsync({ id: lead.id, body: { stage: values.stage, position: LAST_POSITION } });
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
      raise(t("crm.deleted"), "success");
      onClose();
    } catch (error) {
      setConfirming(false);
      raise(messageOf(error));
    }
  }

  const textRow = (field: TextField, label: MessageKey) => (
    <Row id={`lead-${field}`} label={label}>
      <input
        id={`lead-${field}`}
        className={INPUT}
        placeholder={editable ? t("crm.card.placeholder") : undefined}
        disabled={!editable}
        {...register(field)}
      />
    </Row>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "flex h-[min(860px,calc(100vh-2rem))] flex-col gap-0 p-0",
          lead
            ? "w-[min(1180px,calc(100vw-2rem))] min-w-[min(1180px,calc(100vw-2rem))]"
            : "w-[min(640px,calc(100vw-2rem))] min-w-[min(640px,calc(100vw-2rem))]",
        )}
      >
        <DialogTitle className="sr-only">{lead ? lead.name : t("crm.create")}</DialogTitle>

        <div className={cn(
          "grid min-h-0 flex-1",
          lead && "grid-rows-[auto_auto] overflow-y-auto md:grid-cols-2 md:grid-rows-1 md:overflow-hidden",
        )}>
          <form onSubmit={onSubmit} className={cn("flex min-h-0 flex-col", lead && "md:border-r md:border-border")}>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="w-fit">
                <Label htmlFor="lead-stage" className="sr-only">{t("crm.form.stage")}</Label>
                <Controller
                  control={control}
                  name="stage"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                      <SelectTrigger id="lead-stage" className="h-8 rounded-full border-primary/30 bg-primary/10 text-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(columns ?? FIXED_LEAD_COLUMNS).map((option) => (
                          <SelectItem key={option.id} value={option.id}>{leadColumnLabel(option)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <input
                  aria-label={t("crm.form.name")}
                  placeholder={t("crm.form.name")}
                  className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
                  disabled={!editable}
                  aria-invalid={errors.name ? true : undefined}
                  {...register("name", { validate: (value) => value.trim() !== "" || t("crm.form.nameRequired") })}
                />
                {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name.message}</p> : null}
              </div>

              <ul aria-label={t("crm.card.fields")} className="flex flex-col">
                <Row id="lead-amount" label="crm.card.amount">
                  <input
                    id="lead-amount"
                    inputMode="decimal"
                    className={INPUT}
                    placeholder={editable ? t("crm.card.placeholder") : undefined}
                    disabled={!editable}
                    aria-invalid={errors.amount ? true : undefined}
                    {...register("amount", { validate: (value) => isAmount(value) || t("crm.card.amountInvalid") })}
                  />
                  {errors.amount ? <p className="px-2 text-xs text-destructive">{errors.amount.message}</p> : null}
                </Row>

                <Row id="lead-assignee" label="crm.form.assignee">
                  <Controller
                    control={control}
                    name="assigneeId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={!editable || !clientMembers}>
                        <SelectTrigger id="lead-assignee" className="h-9 w-full border-transparent shadow-none hover:border-input"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t("crm.form.unassigned")}</SelectItem>
                          {assignees.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <span className="flex min-w-0 items-center gap-2">
                                <MemberAvatar member={member} size="sm" />
                                <span className="truncate">{member.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Row>

                {textRow("company", "crm.form.company")}

                <Row id="lead-tags" label="crm.card.tags">
                  <div role="group" aria-labelledby="lead-tags-label">
                    <Controller
                      control={control}
                      name="tags"
                      render={({ field }) => (
                        <LeadTags value={field.value} onChange={field.onChange} suggestions={suggestions} disabled={!editable} />
                      )}
                    />
                  </div>
                </Row>

                {textRow("service", "crm.card.service")}
                {textRow("phone", "crm.card.phone")}
                {textRow("telegram", "crm.card.telegram")}
                {textRow("messenger", "crm.card.messenger")}
                {textRow("email", "crm.form.email")}
                {textRow("website", "crm.form.website")}
                {textRow("source", "crm.form.source")}

              </ul>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lead-notes">{t("crm.card.description")}</Label>
                <textarea
                  id="lead-notes"
                  className="min-h-28 rounded-md border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!editable}
                  {...register("notes")}
                />
              </div>

            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
              {lead && capabilities.delete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                  onClick={() => setConfirming(true)}
                >
                  {t("crm.delete")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
              {editable ? (
                <Button type="submit" disabled={isSubmitting}>{lead ? t("crm.form.save") : t("crm.form.create")}</Button>
              ) : null}
            </div>
          </form>

          {lead ? (
            <section className="flex min-h-0 flex-col gap-4 bg-muted/20 p-6 pt-10">
              <Tabs
                items={[
                  { id: "activity", label: t("crm.card.activity") },
                  { id: "files", label: t("crm.card.files") },
                  ...(lead.metaSource ? [{ id: "info", label: t("crm.card.info") }] : []),
                ]}
                activeId={tab}
                onSelect={(id) => setTab(id as Tab)}
                ariaLabel={t("crm.card.tabs")}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "info" && lead.metaSource ? (
                  <LeadSourceSection
                    source={lead.metaSource}
                    onPreview={lead.ad && onPreviewCreative ? () => onPreviewCreative(lead.ad!) : undefined}
                  />
                ) : tab === "files" ? (
                  <LeadFilesTab boardKey={boardKey} leadId={lead.id} editable={capabilities.update} />
                ) : (
                  <LeadActivityTab boardKey={boardKey} leadId={lead.id} />
                )}
              </div>
            </section>
          ) : null}
        </div>
      </DialogContent>

      {confirming ? (
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
