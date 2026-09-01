import { useState } from "react";
import { DatePicker } from "@/shared/ui/index.js";
import { formatDay } from "@/shared/lib/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useUpdateRecord } from "@/entities/campaign/index.js";

export interface SheetDateCellProps {
  campaignId: string;
  recordId: string;
  date: string;
}

export function SheetDateCell({ campaignId, recordId, date }: SheetDateCellProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateRecord(campaignId);

  async function select(iso: string) {
    setOpen(false);
    if (iso === date) return;
    setError(null);
    try {
      await update.mutateAsync({ id: recordId, body: { date: iso } });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t("sheet.date.failed"));
    }
  }

  return (
    <DatePicker
      value={date}
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null);
        setOpen(next);
      }}
      labels={{
        dialog: t("sheet.date.choose"),
        previousMonth: t("sheet.date.previousMonth"),
        nextMonth: t("sheet.date.nextMonth"),
      }}
      onSelect={(iso) => void select(iso)}
    >
      <button
        type="button"
        className="flex items-center gap-3 rounded-md p-1.5 hover:bg-accent"
        data-state={error != null ? "error" : undefined}
        title={error ?? undefined}
      >
        {formatDay(date)}
      </button>
    </DatePicker>
  );
}
