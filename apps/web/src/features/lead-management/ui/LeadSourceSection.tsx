import type { LeadMetaSource } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";

export interface LeadSourceSectionProps {
  source: LeadMetaSource;
  onPreview?: () => void;
}

export function LeadSourceSection({ source, onPreview }: LeadSourceSectionProps) {
  const facts = [
    { key: "account", label: t("crm.source.account"), value: source.accountId },
    { key: "form", label: t("crm.source.form"), value: source.formId },
    { key: "campaign", label: t("crm.source.campaign"), value: source.campaign.name },
    { key: "adSet", label: t("crm.source.adSet"), value: source.adSet.name },
    { key: "ad", label: t("crm.source.ad"), value: source.ad.name },
    { key: "submittedAt", label: t("crm.source.submittedAt"), value: new Date(source.submittedAt).toLocaleString("ru-RU") },
  ];

  return (
    <section aria-label={t("crm.source.title")} className="shrink-0 rounded-lg border border-border bg-muted/30 p-3">
      <h3 className="text-sm font-medium">{t("crm.source.title")}</h3>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {facts.map((fact) => (
          <div key={fact.key} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="break-words">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {source.answers.length > 0 ? (
        <>
          <h4 className="mt-3 text-xs font-medium">{t("crm.source.answers")}</h4>
          <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            {source.answers.map((answer, index) => (
              <div key={`${answer.question}-${index}`} className="contents">
                <dt className="break-all text-muted-foreground">{answer.question}</dt>
                <dd className="whitespace-pre-wrap break-words">{answer.values.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      {source.answersOmitted ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("crm.source.answersOmitted")}</p>
      ) : null}

      {onPreview ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onPreview}>
          {t("crm.source.preview")}
        </Button>
      ) : null}
    </section>
  );
}
