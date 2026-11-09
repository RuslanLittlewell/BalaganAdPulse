import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { DatePicker } from "../DatePicker/DatePicker.js";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{2})-(\d{2})-(\d{4})$/;

const shown = (value: string) => value.replace(ISO, "$3-$2-$1");
const stored = (text: string) => text.replace(DMY, "$3-$2-$1");

export type DateRangeSide = "from" | "to";

export interface DateRangeFieldsLabels {
  from: string;
  to: string;
  openFrom: string;
  openTo: string;
  dialogFrom: string;
  dialogTo: string;
  previousMonth: string;
  nextMonth: string;
}

export interface DateRangeFieldsProps {
  idPrefix: string;
  values: Record<DateRangeSide, string>;
  pickerValues: Record<DateRangeSide, string>;
  error: string | null;
  inline?: boolean;
  labels: DateRangeFieldsLabels;
  onChange: (side: DateRangeSide, value: string) => void;
}

export function DateRangeFields({ idPrefix, values, pickerValues, error, inline = false, labels, onChange }: DateRangeFieldsProps) {
  const [open, setOpen] = useState<DateRangeSide | null>(null);
  return (
    <>
      {(["from", "to"] as const).map((side) => (
        <div key={side} className={inline ? "flex items-center gap-1.5" : "flex w-30 flex-col gap-1"}>
          <Label htmlFor={`${idPrefix}-${side}`} className="text-xs text-muted-foreground">
            {labels[side]}
          </Label>
          <div className="flex gap-1">
            <Input
              id={`${idPrefix}-${side}`}
              value={shown(values[side])}
              onChange={(event) => onChange(side, stored(event.target.value))}
              placeholder="ДД-ММ-ГГГГ"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idPrefix}-error` : undefined}
              className={inline ? "h-6 w-28 font-mono text-xs" : "h-6 font-mono text-xs"}
            />
            <DatePicker
              value={pickerValues[side]}
              open={open === side}
              onOpenChange={(next) => setOpen(next ? side : null)}
              labels={{
                dialog: side === "from" ? labels.dialogFrom : labels.dialogTo,
                previousMonth: labels.previousMonth,
                nextMonth: labels.nextMonth,
              }}
              onSelect={(value) => {
                onChange(side, value);
                setOpen(null);
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-6 shrink-0 bg-transparent dark:bg-transparent"
                aria-label={side === "from" ? labels.openFrom : labels.openTo}
              >
                <CalendarIcon />
              </Button>
            </DatePicker>
          </div>
        </div>
      ))}
      {error != null && (
        <p id={`${idPrefix}-error`} role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
