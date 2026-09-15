import { useState } from "react";
import { Plus } from "lucide-react";
import type { LeadColumn } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { ColumnNameDialog } from "./ColumnNameDialog.js";

export interface AddLeadColumnProps {
  boardKey: string;
  columns: readonly LeadColumn[];
}

export function AddLeadColumn({ boardKey, columns }: AddLeadColumnProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("crm.columns.add")}
        onClick={() => setOpen(true)}
        className={cn(
          "grid h-full min-h-40 w-80 shrink-0 place-items-center rounded-xl border-2 border-dashed border-border",
          "text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Plus aria-hidden className="size-6" />
      </button>

      {open ? (
        <ColumnNameDialog boardKey={boardKey} columns={columns} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
