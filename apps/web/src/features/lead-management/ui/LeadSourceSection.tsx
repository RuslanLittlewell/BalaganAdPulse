import { getIntlLocale } from "@/shared/config/locale.js";
import type { LeadMetaSource } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { formatDateTime } from "@/shared/lib/index.js";
import { Button } from "@/shared/ui/index.js";

export interface LeadSourceSectionProps {
  source: LeadMetaSource;
  onPreview?: () => void;
}

const META_FIELD_LABELS: Record<string, string> = {
  full_name: t("auth.name.label"),
  first_name: t("auth.name.label"),
  last_name: t("crm.source.lastName"),
  phone_number: t("contacts.phone"),
  work_phone_number: t("crm.source.workPhone"),
  email: t("auth.email.label"),
  work_email: t("crm.source.workEmail"),
  company_name: t("crm.source.company"),
  job_title: t("crm.source.jobTitle"),
  city: t("crm.source.city"),
  country: t("crm.source.country"),
  date_of_birth: t("crm.source.birthDate"),
};

export function formatMetaFieldLabel(question: string): string {
  const key = question.trim().toLowerCase();
  const known = META_FIELD_LABELS[key];
  if (known) return known;

  const readable = question.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return readable ? readable.charAt(0).toLocaleUpperCase(getIntlLocale()) + readable.slice(1) : t("crm.source.field");
}

export function LeadSourceSection({ source, onPreview }: LeadSourceSectionProps) {
  const facts = [
    { key: "account", label: t("crm.source.account"), value: source.accountId },
    { key: "form", label: t("crm.source.form"), value: source.formId },
    { key: "campaign", label: t("crm.source.campaign"), value: source.campaign.name },
    { key: "adSet", label: t("crm.source.adSet"), value: source.adSet.name },
    { key: "ad", label: t("crm.source.ad"), value: source.ad.name },
    { key: "submittedAt", label: t("crm.source.submittedAt"), value: formatDateTime(source.submittedAt) },
  ];

  return (
    <section aria-label={t("crm.source.title")} className="shrink-0 rounded-lg border border-border bg-muted/30 p-3">
      <h3 className="text-sm font-semibold">{t("crm.source.title")}</h3>
      <dl className="mt-2 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.key} className="min-w-0">
            <dt className="text-2xs font-medium text-muted-foreground">{fact.label}</dt>
            <dd className="mt-0.5 truncate text-sm" title={fact.value}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {source.answers.length > 0 ? (
        <>
          <h4 className="mt-4 border-t border-border/70 pt-3 text-sm font-semibold">{t("crm.source.answers")}</h4>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {source.answers.map((answer, index) => (
              <div key={`${answer.question}-${index}`} className="min-w-0 rounded-md border border-border/70 bg-background p-2">
                <dt className="text-xs font-medium text-muted-foreground">{formatMetaFieldLabel(answer.question)}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
                  {answer.values.filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      {source.answersOmitted ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("crm.source.answersOmitted")}</p>
      ) : null}

      {onPreview ? (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onPreview}>
          {t("crm.source.preview")}
        </Button>
      ) : null}
    </section>
  );
}
