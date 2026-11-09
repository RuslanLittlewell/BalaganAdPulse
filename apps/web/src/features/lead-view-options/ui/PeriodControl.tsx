import { useEffect, useState } from "react";
import { t } from "@/shared/config/index.js";
import { DateRangeFields, toIso } from "@/shared/ui/index.js";
import type { Filter, ViewState } from "../model/viewState.js";

export interface PeriodControlProps {
  view: Pick<ViewState, "filters">;
  onChange: (filters: Filter[]) => void;
}

const isPeriod = (filter: Filter) => filter.field === "arrival" && filter.operator === "between";

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const fits = (value: string) => value === "" || isDay(value);

const labels = () => ({
  from: t("crm.view.periodFrom"),
  to: t("crm.view.periodTo"),
  openFrom: t("period.from.open"),
  openTo: t("period.to.open"),
  dialogFrom: t("period.from.dialog"),
  dialogTo: t("period.to.dialog"),
  previousMonth: t("period.previousMonth"),
  nextMonth: t("period.nextMonth"),
});

let sequence = 0;

export function PeriodControl({ view, onChange }: PeriodControlProps) {
  const current = view.filters.find(isPeriod);
  const [from = "", to = ""] = Array.isArray(current?.value) ? current.value : [];
  const [draft, setDraft] = useState({ from, to });

  useEffect(() => { setDraft({ from, to }); }, [from, to]);

  const today = toIso(new Date());
  const reversed = isDay(draft.from) && isDay(draft.to) && draft.from > draft.to;

  function apply(next: { from: string; to: string }) {
    const others = view.filters.filter((filter) => !isPeriod(filter));
    if (next.from === "" && next.to === "") {
      onChange(others);
      return;
    }
    const value: [string, string] = [next.from, next.to];
    const period: Filter = current
      ? { ...current, value }
      : { id: `filter-period-${Date.now().toString(36)}-${++sequence}`, field: "arrival", operator: "between", value };
    onChange(current ? view.filters.map((filter) => (filter === current ? period : filter)) : [...others, period]);
  }

  function change(side: "from" | "to", value: string) {
    const next = { ...draft, [side]: value };
    setDraft(next);
    if (fits(next.from) && fits(next.to)) apply(next);
  }

  return (
    <div role="group" aria-label={t("crm.view.period")} className="flex flex-wrap items-center gap-2">
      <DateRangeFields
        idPrefix="crm-period"
        inline
        values={draft}
        pickerValues={{ from: isDay(draft.from) ? draft.from : today, to: isDay(draft.to) ? draft.to : today }}
        error={reversed ? t("crm.view.periodReversed") : null}
        labels={labels()}
        onChange={change}
      />
    </div>
  );
}
