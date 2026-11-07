import { readableNumber, useLeadActivity, type CustomChangeValue, type LeadActivity, type LeadActivityChange, type LeadActivityField, type LeadCustomChange } from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { formatDateTime } from "@/shared/lib/index.js";
import { Loader } from "@/shared/ui/index.js";
import { calendarDay } from "../lib/custom-values.js";

const FIELD_LABELS: Record<LeadActivityField, MessageKey> = {
  name: "crm.form.name",
  amount: "crm.card.amount",
  assignee: "crm.form.assignee",
  company: "crm.form.company",
  tags: "crm.card.tags",
  service: "crm.card.service",
  phone: "crm.card.phone",
  telegram: "crm.card.telegram",
  messenger: "crm.card.messenger",
  email: "crm.form.email",
  website: "crm.form.website",
  source: "crm.form.source",
  campaign: "crm.form.campaign",
  notes: "crm.card.description",
};

const shown = (value: string | null) => value || t("crm.activity.nothing");

function customShown(change: LeadCustomChange, value: CustomChangeValue): string {
  if (typeof value === "boolean") return value ? t("crm.activity.yes") : t("crm.activity.no");
  if (Array.isArray(value)) return shown(value.map((name) => name ?? t("crm.activity.removedOption")).join(", "));
  if (value === null) return shown(null);
  if (change.type === "DATE") return calendarDay(value);
  if (change.type === "NUMBER") return readableNumber(value);
  return shown(value);
}

function changeLine(change: LeadActivityChange): string {
  if (change.field === "custom") return `${change.name}: ${customShown(change, change.before)} → ${customShown(change, change.after)}`;
  return `${t(FIELD_LABELS[change.field])}: ${shown(change.before)} → ${shown(change.after)}`;
}

function linesOf(entry: LeadActivity): string[] {
  switch (entry.kind) {
    case "created": return [t("crm.activity.created")];
    case "imported": return [t("crm.activity.imported")];
    case "moved": return [
      `${t("crm.activity.stage")}: ${entry.stage.from ?? t("crm.activity.removedColumn")} → ${entry.stage.to ?? t("crm.activity.removedColumn")}`,
    ];
    case "changed": return entry.changes.map(changeLine);
    case "file-added": return [`${t("crm.activity.fileAdded")}: ${entry.file.name}`];
    case "file-removed": return [`${t("crm.activity.fileRemoved")}: ${entry.file.name}`];
  }
}

export function LeadActivityTab({ boardKey, leadId }: { boardKey: string; leadId: string }) {
  const { data: entries, isPending } = useLeadActivity(boardKey, leadId);

  if (isPending) return <Loader label={t("state.loading")} />;
  if (!entries?.length) return <p className="text-sm text-muted-foreground">{t("crm.activity.empty")}</p>;

  return (
    <ol aria-label={t("crm.card.activity")} className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{entry.actor?.name ?? ""}</span>
            <time dateTime={entry.at} className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(entry.at)}
            </time>
          </div>
          {linesOf(entry).map((line) => (
            <p key={line} className="mt-1 break-words text-muted-foreground">{line}</p>
          ))}
        </li>
      ))}
    </ol>
  );
}
