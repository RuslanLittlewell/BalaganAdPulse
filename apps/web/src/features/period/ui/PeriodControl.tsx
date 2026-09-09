import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button, DatePicker, Input, Label } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import type { DateRange } from "@/entities/campaign/index.js";
import { isDateRange, isIsoDate } from "../model/period.js";
import { usePeriod } from "../model/usePeriod.js";

const labels = (side: "from" | "to") => ({
  dialog: t(side === "from" ? "period.from.dialog" : "period.to.dialog"),
  previousMonth: t("period.previousMonth"),
  nextMonth: t("period.nextMonth"),
});

export function PeriodControl() {
  const { range, setRange } = usePeriod();
  const [draft, setDraft] = useState<DateRange>(range);
  const [open, setOpen] = useState<"from" | "to" | null>(null);

  useEffect(() => { setDraft(range); }, [range.from, range.to]);

  const error = !isIsoDate(draft.from) || !isIsoDate(draft.to)
    ? t("period.invalid")
    : draft.from > draft.to
      ? t("period.reversed")
      : null;

  const change = (side: "from" | "to", value: string) => {
    const next = { ...draft, [side]: value };
    setDraft(next);
    if (isDateRange(next)) setRange(next);
  };

  return (
    <div role="group" aria-label={t("period.label")} className="flex flex-wrap items-start gap-2">
      {(["from", "to"] as const).map((side) => {
        const fieldError = error == null ? undefined : error;
        return (
          <div key={side} className="flex w-36 flex-col gap-1">
            <Label
              htmlFor={`period-${side}`}
              className="font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground"
            >
              {t(side === "from" ? "period.from" : "period.to")}
            </Label>
            <div className="flex gap-1">
              <Input
                id={`period-${side}`}
                value={draft[side]}
                onChange={(event) => change(side, event.target.value)}
                placeholder="ГГГГ-ММ-ДД"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "period-error" : undefined}
                className="h-8 font-mono text-xs"
              />
              <DatePicker
                value={isIsoDate(draft[side]) ? draft[side] : range[side]}
                open={open === side}
                onOpenChange={(nextOpen) => setOpen(nextOpen ? side : null)}
                labels={labels(side)}
                onSelect={(value) => {
                  change(side, value);
                  setOpen(null);
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={t(side === "from" ? "period.from.open" : "period.to.open")}
                >
                  <CalendarIcon />
                </Button>
              </DatePicker>
            </div>
          </div>
        );
      })}
      {error != null && (
        <p id="period-error" role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
