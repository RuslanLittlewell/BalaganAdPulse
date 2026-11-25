import type { LeadWebSource } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { formatDateTime } from "@/shared/lib/index.js";
import { formatMetaFieldLabel } from "./LeadSourceSection.js";

export function WebsiteSourceSection({ source, imported = false }: { source: LeadWebSource; imported?: boolean }) {
  const title = imported ? t("crm.import.title") : t("crm.web.title");
  const facts = [
    { key: "utmSource", label: t("crm.web.utmSource"), value: source.utmSource },
    { key: "utmMedium", label: t("crm.web.utmMedium"), value: source.utmMedium },
    { key: "utmCampaign", label: t("crm.web.utmCampaign"), value: source.utmCampaign },
    { key: "utmContent", label: t("crm.web.utmContent"), value: source.utmContent },
    { key: "utmTerm", label: t("crm.web.utmTerm"), value: source.utmTerm },
    { key: "pageUrl", label: t("crm.web.pageUrl"), value: source.pageUrl },
    { key: "referrer", label: t("crm.web.referrer"), value: source.referrer },
    { key: "submittedAt", label: t("crm.source.submittedAt"), value: formatDateTime(source.submittedAt) },
  ].filter((fact): fact is { key: string; label: string; value: string } => Boolean(fact.value));

  return (
    <section aria-label={title} className="shrink-0 rounded-lg border border-border bg-muted/30 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
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
    </section>
  );
}
