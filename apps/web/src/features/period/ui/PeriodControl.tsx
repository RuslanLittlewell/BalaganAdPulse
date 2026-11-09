import { useEffect, useState } from "react";
import { Button, DateRangeFields } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import type { DateRange } from "@/entities/campaign/index.js";
import { SHORTCUTS, isDateRange, isIsoDate, shortcutRange } from "../model/period.js";
import { usePeriod } from "../model/usePeriod.js";

const labels = () => ({
  from: t("period.from"),
  to: t("period.to"),
  openFrom: t("period.from.open"),
  openTo: t("period.to.open"),
  dialogFrom: t("period.from.dialog"),
  dialogTo: t("period.to.dialog"),
  previousMonth: t("period.previousMonth"),
  nextMonth: t("period.nextMonth"),
});

export function PeriodControl() {
  const { range, setRange } = usePeriod();
  const [draft, setDraft] = useState<DateRange>(range);

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
      <div className="flex items-center self-end">
        {SHORTCUTS.map((shortcut) => {
          const preset = shortcutRange(shortcut);
          const active = preset.from === range.from && preset.to === range.to;
          return (
            <Button
              key={shortcut}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              aria-pressed={active}
              onClick={() => setRange(preset)}
            >
              {t(`period.${shortcut}`)}
            </Button>
          );
        })}
      </div>
      <DateRangeFields
        idPrefix="period"
        values={draft}
        pickerValues={{
          from: isIsoDate(draft.from) ? draft.from : range.from,
          to: isIsoDate(draft.to) ? draft.to : range.to,
        }}
        error={error}
        labels={labels()}
        onChange={change}
      />
    </div>
  );
}
