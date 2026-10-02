import { useLeadActivity, type LeadActivity, type LeadActivityField } from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { Loader } from "@/shared/ui/index.js";

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

function linesOf(entry: LeadActivity): string[] {
  switch (entry.kind) {
    case "created": return [t("crm.activity.created")];
    case "imported": return [t("crm.activity.imported")];
    case "moved": return [
      `${t("crm.activity.stage")}: ${entry.stage.from ?? t("crm.activity.removedColumn")} → ${entry.stage.to ?? t("crm.activity.removedColumn")}`,
    ];
    case "changed": return entry.changes.map((change) =>
      `${t(FIELD_LABELS[change.field])}: ${shown(change.before)} → ${shown(change.after)}`);
    case "file-added": return [`${t("crm.activity.fileAdded")}: ${entry.file.name}`];
    case "file-removed": return [`${t("crm.activity.fileRemoved")}: ${entry.file.name}`];
  }
}

export function LeadActivityTab({ boardKey, leadId }: { boardKey: string; leadId: string }) {
  const { data: entries, isPending } = useLeadActivity(boardKey, leadId);

  if (isPending) return <Loader label={t("state.loading")} />;
  if (!entries?.length) return <p className="text-sm text-muted-foreground">{t("crm.activity.empty")}</p>;

  return (
    <ol aria-label={t("crm.card.activity")} className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{entry.actor?.name ?? ""}</span>
            <time dateTime={entry.at} className="shrink-0 text-xs text-muted-foreground">
              {new Date(entry.at).toLocaleString("ru-RU")}
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
