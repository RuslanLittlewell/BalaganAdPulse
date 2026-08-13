import { useState } from "react";
import { DatePicker } from "../../../../components/DatePicker/DatePicker.js";
import { formatDay } from "../../../../lib/format.js";
import { ApiError } from "../../../../lib/http.js";
import { t } from "../../../../i18n/en.js";
import { useUpdateRecord } from "../../data/queries.js";
import styles from "./SheetDateCell.module.css";

export interface SheetDateCellProps {
  campaignId: string;
  recordId: string;
  date: string;
}

export function SheetDateCell({ campaignId, recordId, date }: SheetDateCellProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // In state, not a ref: the picker needs a re-render once the trigger it anchors to exists.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
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
    <>
      <button
        type="button"
        ref={setTrigger}
        className={styles.trigger}
        data-state={error != null ? "error" : undefined}
        title={error ?? undefined}
        onClick={() => {
          setError(null);
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        {formatDay(date)}
      </button>
      {open && (
        <DatePicker
          value={date}
          anchorTo={trigger}
          labels={{
            dialog: t("sheet.date.choose"),
            previousMonth: t("sheet.date.previousMonth"),
            nextMonth: t("sheet.date.nextMonth"),
          }}
          onSelect={select}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
