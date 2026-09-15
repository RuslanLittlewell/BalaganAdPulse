import { useState, type FormEvent } from "react";
import { useCreateLeadColumn, useUpdateLeadColumn, type LeadColumn } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
  useAlerts,
} from "@/shared/ui/index.js";
import { columnNameError } from "../lib/columnName.js";

export interface ColumnNameDialogProps {
  boardKey: string;
  columns: readonly LeadColumn[];
  column?: LeadColumn;
  onClose: () => void;
}

export function ColumnNameDialog({ boardKey, columns, column, onClose }: ColumnNameDialogProps) {
  const create = useCreateLeadColumn(boardKey);
  const update = useUpdateLeadColumn(boardKey);
  const { raise } = useAlerts();
  const [name, setName] = useState(column?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = columnNameError(name, columns, column?.id);
    setError(problem);
    if (problem) return;
    const trimmed = name.trim();
    try {
      if (column) {
        if (trimmed !== column.name) await update.mutateAsync({ id: column.id, body: { name: trimmed } });
      } else {
        await create.mutateAsync(trimmed);
      }
      onClose();
    } catch {
      raise(t("crm.columns.saveFailed"));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{column ? t("crm.columns.renameTitle") : t("crm.columns.createTitle")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <TextField
            label={t("crm.columns.name")}
            value={name}
            error={error ?? undefined}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {column ? t("crm.columns.save") : t("crm.columns.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
