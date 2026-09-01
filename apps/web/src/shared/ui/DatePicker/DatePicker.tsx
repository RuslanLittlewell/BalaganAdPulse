import type { ReactNode } from "react";
import { ru } from "react-day-picker/locale";
import { Calendar } from "../ui/calendar.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { dayLabel, fromIso, toIso } from "./month.js";

export interface DatePickerLabels {
  dialog: string;
  previousMonth: string;
  nextMonth: string;
}

export interface DatePickerProps {
  /** The selected day, "YYYY-MM-DD". */
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: DatePickerLabels;
  onSelect: (iso: string) => void;
  /** The control the calendar hangs under. */
  children: ReactNode;
}

/**
 * shadcn's Calendar in a Popover. The popover is what makes this work inside the
 * table: it renders through a portal and is placed by collision detection, so a
 * scrolling table cannot clip it and a sticky cell cannot stack over it — the two
 * problems the previous hand-placed version existed to solve.
 */
export function DatePicker({
  value,
  open,
  onOpenChange,
  labels,
  onSelect,
  children,
}: DatePickerProps) {
  const selected = fromIso(value);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" aria-label={labels.dialog}>
        <Calendar
          mode="single"
          required
          locale={ru}
          autoFocus
          defaultMonth={selected}
          selected={selected}
          onSelect={(date) => { if (date != null) onSelect(toIso(date)); }}
          labels={{
            labelDayButton: (date) => dayLabel(toIso(date)),
            labelPrevious: () => labels.previousMonth,
            labelNext: () => labels.nextMonth,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
