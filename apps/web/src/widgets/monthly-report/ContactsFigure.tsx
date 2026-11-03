import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { cn } from "@/shared/lib/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import {
  Button,
  RollingNumber,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import type { Report, ReportEdit } from "@/entities/report/index.js";
import { NumberEditor } from "./NumberEditor.js";

const MANUAL = "MANUAL";

export const contactsLabel = (source: string | null) =>
  source === null ? t("report.messengerContacts") : t(`resultType.${source}` as MessageKey);

export function ContactsFigure({
  report,
  editable,
  pending,
  onSave,
}: {
  report: Report;
  editable: boolean;
  pending: boolean;
  onSave: (change: ReportEdit, done?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const label = contactsLabel(report.contactsSource);
  const totals = report.resultTotals ?? [];
  const manual = report.contactsSource === null;
  const pencil = editable && manual && !editing;

  return (
    <div className="relative rounded-lg border border-border glass-card p-3">
      <div className={cn("text-xs font-medium text-muted-foreground", pencil && "pr-8")}>{label}</div>
      {pencil ? (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("report.edit")}
          className="absolute top-2 right-2"
          onClick={() => setEditing(true)}
        >
          <PencilIcon aria-hidden />
        </Button>
      ) : null}
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        <RollingNumber value={report.contacts ?? "—"} />
      </div>
      {editable ? (
        <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
          {totals.length > 0 ? (
            <Select
              value={report.contactsSource ?? MANUAL}
              disabled={pending}
              onValueChange={(value) => onSave({ contactsSource: value === MANUAL ? null : value })}
            >
              <SelectTrigger size="sm" aria-label={t("report.contacts.source")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>{t("report.contacts.manual")}</SelectItem>
                {totals.map((total) => (
                  <SelectItem key={total.type} value={total.type}>
                    {contactsLabel(total.type)} · {total.results}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {report.resultTotals === null ? <span>{t("report.contacts.refreshHint")}</span> : null}
          {manual && editing ? (
            <NumberEditor
              label={label}
              initial={report.messengerContacts}
              pending={pending}
              onCancel={() => setEditing(false)}
              onSave={(next) => onSave({ messengerContacts: next }, () => setEditing(false))}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
