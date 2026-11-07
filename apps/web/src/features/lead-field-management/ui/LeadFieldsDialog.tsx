import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  FIELD_LIMIT,
  OptionChip,
  useDeleteLeadField,
  useLeadFields,
  useLeads,
  useUpdateLeadField,
  type BoardCapabilities,
  type LeadField,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Loader,
  useAlerts,
} from "@/shared/ui/index.js";
import { FieldForm } from "./FieldForm.js";

export interface LeadFieldsDialogProps {
  boardKey: string;
  capabilities: BoardCapabilities;
  onClose: () => void;
}

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; field: LeadField };

export function LeadFieldsDialog({ boardKey, capabilities, onClose }: LeadFieldsDialogProps) {
  const { data: fields, isPending } = useLeadFields(boardKey);
  const { data: leads } = useLeads(boardKey);
  const update = useUpdateLeadField(boardKey);
  const remove = useDeleteLeadField(boardKey);
  const { raise } = useAlerts();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [deleting, setDeleting] = useState<LeadField | null>(null);
  const list = fields ?? [];

  const holders = deleting ? (leads ?? []).filter((lead) => lead.customValues?.[deleting.id] !== undefined).length : 0;

  function shift(field: LeadField, by: number) {
    update.mutate(
      { id: field.id, body: { position: field.position + by } },
      { onError: () => raise(t("crm.fields.moveFailed")) },
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } catch {
      raise(t("crm.fields.deleteFailed"));
    }
    setDeleting(null);
  }

  const title = mode.kind === "add" ? t("crm.fields.addTitle") : mode.kind === "edit" ? t("crm.fields.editTitle") : t("crm.fields.title");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[min(720px,calc(100vh-2rem))] w-[min(520px,calc(100vw-2rem))] flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {mode.kind === "list" ? (
          <div className="flex min-h-0 flex-col gap-3">
            {isPending ? <Loader label={t("state.loading")} /> : null}
            {!isPending && list.length === 0 ? <p className="text-sm text-muted-foreground">{t("crm.fields.empty")}</p> : null}
            {list.length > 0 ? (
              <ul aria-label={t("crm.fields.title")} className="flex min-h-0 flex-col overflow-y-auto">
                {list.map((field, index) => (
                  <li key={field.id} data-field={field.name} className="flex items-center gap-2 border-b border-border py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{field.name}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>{t(`crm.fields.type.${field.type}`)}</span>
                        {field.options.map((option) => <OptionChip key={option.id} name={option.name} color={option.color} />)}
                      </span>
                    </div>
                    {capabilities.update || capabilities.delete ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`${t("crm.fields.actions")}: ${field.name}`}>
                            <MoreHorizontal aria-hidden className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {capabilities.update ? (
                            <>
                              <DropdownMenuItem onSelect={() => setMode({ kind: "edit", field })}>{t("crm.fields.edit")}</DropdownMenuItem>
                              <DropdownMenuItem disabled={index === 0} onSelect={() => shift(field, -1)}>{t("crm.fields.moveUp")}</DropdownMenuItem>
                              <DropdownMenuItem disabled={index === list.length - 1} onSelect={() => shift(field, 1)}>{t("crm.fields.moveDown")}</DropdownMenuItem>
                            </>
                          ) : null}
                          {capabilities.delete ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(field)}>{t("crm.fields.delete")}</DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {capabilities.create && !isPending ? (
              list.length < FIELD_LIMIT ? (
                <Button type="button" variant="outline" className="w-fit gap-1" onClick={() => setMode({ kind: "add" })}>
                  <Plus aria-hidden className="size-3" />
                  {t("crm.fields.add")}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t("crm.fields.limit")}</p>
              )
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto">
            <FieldForm
              boardKey={boardKey}
              fields={list}
              field={mode.kind === "edit" ? mode.field : undefined}
              onDone={() => setMode({ kind: "list" })}
            />
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleting !== null}
        title={t("crm.fields.deleteTitle")}
        description={holders > 0 ? `${t("crm.fields.deleteHolders")} ${holders}. ${t("crm.fields.deleteClears")}` : t("crm.fields.deleteNone")}
        confirmLabel={t("crm.fields.deleteConfirm")}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Dialog>
  );
}
