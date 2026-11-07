import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import {
  ColumnPill,
  FIXED_LEAD_COLUMNS,
  LetterAvatar,
  leadColumnLabel,
  useDeleteLead,
  useLeadColumns,
  useMoveLead,
  type BoardCapabilities,
  type Lead,
  type LeadInput,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  useAlerts,
} from "@/shared/ui/index.js";
import { InlineText } from "@/shared/ui/index.js";

const LAST_POSITION = 2147483647;

export interface PanelHeaderProps {
  boardKey: string;
  lead: Lead;
  capabilities: BoardCapabilities;
  save: (body: LeadInput) => Promise<boolean>;
  onClose: () => void;
}

export function PanelHeader({ boardKey, lead, capabilities, save, onClose }: PanelHeaderProps) {
  const { data: loaded } = useLeadColumns(boardKey);
  const columns = loaded ?? FIXED_LEAD_COLUMNS;
  const current = columns.find((column) => column.id === lead.stage);
  const move = useMoveLead(boardKey);
  const remove = useDeleteLead(boardKey);
  const { raise } = useAlerts();
  const [confirming, setConfirming] = useState(false);
  const nameId = `panel-name-${lead.id}`;

  function changeStage(stage: string) {
    if (stage === lead.stage) return;
    move.mutate(
      { id: lead.id, body: { stage, position: LAST_POSITION } },
      { onError: () => raise(t("crm.moveFailed")) },
    );
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(lead.id);
      setConfirming(false);
      raise(t("crm.deleted"), "success");
      onClose();
    } catch {
      setConfirming(false);
      raise(t("crm.form.saveFailed"));
    }
  }

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <LetterAvatar name={lead.name} className="size-6 text-xs" />
        <span id={nameId} className="sr-only">{t("crm.panel.name")}</span>
        <div className="min-w-0 flex-1 text-base font-semibold">
          <InlineText
            labelId={nameId}
            value={lead.name}
            editable={capabilities.update}
            validate={(value) => (value.trim() === "" ? "crm.form.nameRequired" : null)}
            onSave={(name) => save({ name: name ?? "" })}
          />
        </div>
        {capabilities.delete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("crm.panel.menu")}>
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>{t("crm.delete")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("crm.panel.close")} onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="w-fit">
        {capabilities.update ? (
          <Select value={lead.stage} onValueChange={changeStage}>
            <SelectTrigger aria-label={t("crm.panel.stage")} className="h-7 gap-1 border-transparent px-1 shadow-none hover:border-input">
              {current ? <ColumnPill name={leadColumnLabel(current)} color={current.color} /> : null}
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>{leadColumnLabel(column)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : current ? (
          <span aria-label={t("crm.panel.stage")}><ColumnPill name={leadColumnLabel(current)} color={current.color} /></span>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title={t("crm.deleteConfirm")}
        description={t("crm.deleteQuestion")}
        confirmLabel={t("crm.deleteConfirm")}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setConfirming(false)}
      />
    </header>
  );
}
