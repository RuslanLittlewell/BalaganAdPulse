import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Input, useAlerts } from "@/shared/ui/index.js";
import { monthTitle, useEnterHistory, type MonthEntry, type Report } from "@/entities/report/index.js";

const ENTERED_MONTHS = 5;
const LEADS = /^\d{1,7}$/;
const SPEND = /^\d{1,14}(?:[.,]\d{1,4})?$/;

function monthsBefore(month: string, count: number): string[] {
  const [year, index] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, offset) =>
    new Date(Date.UTC(year!, index! - 1 - count + offset, 1)).toISOString().slice(0, 7));
}

interface Row {
  month: string;
  leads: string;
  spend: string;
}

const rowProblem = (row: Row) =>
  (row.leads !== "" && !LEADS.test(row.leads)) ||
  (row.spend !== "" && !SPEND.test(row.spend)) ||
  (row.leads === "" && row.spend !== "");

export function TrendHistory({ report }: { report: Report }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const enter = useEnterHistory(report);
  const { raise } = useAlerts();
  const entered = new Map((report.history ?? []).map((entry) => [entry.month, entry]));
  const shown = new Map(report.trend.map((point) => [point.month, point]));

  const open = () =>
    setRows(monthsBefore(report.month, ENTERED_MONTHS).map((month) => ({
      month,
      leads: entered.has(month) ? String(entered.get(month)!.leads) : "",
      spend: entered.get(month)?.spend ? String(Number(entered.get(month)!.spend)) : "",
    })));

  if (rows === null) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button size="sm" variant="outline" onClick={open}>{t("report.history.edit")}</Button>
        <span>{t("report.history.hint")}</span>
      </div>
    );
  }

  const invalid = rows.some(rowProblem);
  const change = (month: string, field: "leads" | "spend", value: string) =>
    setRows(rows.map((row) => (row.month === month ? { ...row, [field]: value.trim() } : row)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const months: MonthEntry[] = rows.map((row) => ({
      month: row.month,
      leads: row.leads === "" ? null : Number(row.leads),
      spend: row.leads === "" || row.spend === "" ? null : row.spend.replace(",", "."),
    }));
    enter.mutate(months, {
      onSuccess: () => setRows(null),
      onError: (error) =>
        raise(error instanceof ApiError && error.status < 500 ? error.message : t("report.saveFailed")),
    });
  };

  return (
    <form
      aria-label={t("report.history.title")}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3"
    >
      <div className="text-sm font-semibold text-foreground">{t("report.history.title")}</div>
      <p className="text-xs text-muted-foreground">{t("report.history.description")}</p>
      <div className="grid max-w-xl grid-cols-[minmax(8rem,1fr)_minmax(5rem,8rem)_minmax(6rem,10rem)] items-center gap-2 text-sm">
        <span />
        <span className="text-xs text-muted-foreground">{t("report.leads")}</span>
        <span className="text-xs text-muted-foreground">{t("report.history.spend")}</span>
        {rows.map((row) => {
          const point = shown.get(row.month);
          const title = monthTitle(row.month);
          return [
            <span key={`${row.month}-title`} className="text-foreground">{title}</span>,
            <Input
              key={`${row.month}-leads`}
              inputMode="numeric"
              aria-label={`${t("report.leads")} · ${title}`}
              aria-invalid={row.leads !== "" && !LEADS.test(row.leads)}
              placeholder={point ? String(point.leads) : "—"}
              value={row.leads}
              onChange={(event) => change(row.month, "leads", event.target.value)}
            />,
            <Input
              key={`${row.month}-spend`}
              inputMode="decimal"
              aria-label={`${t("report.history.spend")} · ${title}`}
              aria-invalid={(row.spend !== "" && !SPEND.test(row.spend)) || (row.leads === "" && row.spend !== "")}
              placeholder={point?.spend ? String(Number(point.spend)) : "—"}
              value={row.spend}
              onChange={(event) => change(row.month, "spend", event.target.value)}
            />,
          ];
        })}
      </div>
      {invalid ? <p role="alert" className="text-xs text-destructive">{t("report.history.invalid")}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={enter.isPending || invalid}>{t("action.save")}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRows(null)}>{t("action.cancel")}</Button>
      </div>
    </form>
  );
}
