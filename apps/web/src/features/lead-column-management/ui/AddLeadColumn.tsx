import { useState } from "react";
import type { LeadColumn } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { AddTile } from "@/shared/ui/index.js";
import { ColumnNameDialog } from "./ColumnNameDialog.js";

export interface AddLeadColumnProps {
  boardKey: string;
  columns: readonly LeadColumn[];
}

export function AddLeadColumn({ boardKey, columns }: AddLeadColumnProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AddTile
        label={t("crm.columns.add")}
        onClick={() => setOpen(true)}
        className="min-h-32 w-64 shrink-0 self-start rounded-xl"
      />

      {open ? (
        <ColumnNameDialog boardKey={boardKey} columns={columns} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
