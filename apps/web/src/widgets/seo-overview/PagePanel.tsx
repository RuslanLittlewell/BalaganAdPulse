import type { ReactNode } from "react";
import { ExternalLinkIcon, X } from "lucide-react";
import { formatCount } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { t } from "@/shared/config/index.js";
import { Button, SidePanel, Skeleton } from "@/shared/ui/index.js";
import { useSeoAuditPage, type SeoAuditPage, type SeoRange } from "@/entities/seo/index.js";
import { position } from "./format.js";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

function Text({ value }: { value: string | null }) {
  return value ? <>{value} <span className="text-xs text-muted-foreground">· {value.length} {t("seo.page.chars")}</span></> : <span className="text-muted-foreground">—</span>;
}

function formatted(source: string): string {
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
}

function Details({ page }: { page: SeoAuditPage }) {
  const facts = page.facts;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
      <a href={page.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-2 hover:underline">
        <ExternalLinkIcon className="size-3.5" />
        {t("seo.page.open")}
      </a>
      <dl className="grid gap-3">
        <Field label={t("seo.page.status")}>
          {page.outcome === "BLOCKED" ? t("seo.page.blocked") : page.outcome === "UNREACHABLE" ? t("seo.page.unreachable") : page.status ?? "—"}
        </Field>
        {page.finalUrl && page.finalUrl !== page.url ? <Field label={t("seo.page.redirect")}>{page.finalUrl}</Field> : null}
        <Field label={t("seo.page.contentType")}>{page.contentType ?? "—"}</Field>
        <Field label={t("seo.page.responseMs")}>{page.responseMs === null ? "—" : `${page.responseMs} ${t("seo.unit.ms")}`}</Field>
        <Field label={t("seo.page.inSitemap")}>{t(page.inSitemap ? "seo.page.yes" : "seo.page.no")}</Field>
        <Field label={t("seo.page.hasImpressions")}>{t(page.hasImpressions ? "seo.page.yes" : "seo.page.no")}</Field>
        <Field label={t("seo.page.problems")}>
          {page.problems.length === 0 ? t("seo.page.noProblems") : (
            <ul className="grid gap-1">
              {page.problems.map((problem) => (
                <li key={problem.kind} className={problem.severity === "ERROR" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
                  {t(`seo.problem.${problem.kind}`)}
                </li>
              ))}
            </ul>
          )}
        </Field>
        {page.search ? (
          <Field label={t("seo.page.search")}>
            <span className="tabular-nums">
              {t("seo.metric.clicks")} {formatCount(page.search.clicks)} · {t("seo.metric.impressions")} {formatCount(page.search.impressions)} · {t("seo.metric.position")} {position(page.search.position)}
            </span>
          </Field>
        ) : null}
      </dl>
      {facts ? (
        <dl className="grid gap-3 border-t border-border pt-3">
          <Field label={t("seo.page.title")}><Text value={facts.title} /></Field>
          <Field label={t("seo.page.description")}><Text value={facts.description} /></Field>
          <Field label={t("seo.page.keywords")}>{facts.keywords ?? <span className="text-muted-foreground">—</span>}</Field>
          <Field label={t("seo.page.h1")}>
            {facts.h1.length === 0 ? <span className="text-muted-foreground">—</span> : <ul className="grid gap-1">{facts.h1.map((text, index) => <li key={index}>{text}</li>)}</ul>}
          </Field>
          <Field label={t("seo.page.canonical")}>{facts.canonical ?? <span className="text-muted-foreground">—</span>}</Field>
          <Field label={t("seo.page.robots")}>{facts.robots.length > 0 ? facts.robots.join(", ") : <span className="text-muted-foreground">—</span>}</Field>
          <Field label={t("seo.page.lang")}>{facts.lang ?? <span className="text-muted-foreground">—</span>}</Field>
          <Field label={t("seo.page.openGraph")}>
            {Object.keys(facts.openGraph).length === 0 ? <span className="text-muted-foreground">—</span> : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {Object.entries(facts.openGraph).map(([key, value]) => (
                  <div key={key} className="contents"><dt className="text-muted-foreground">{key}</dt><dd className="break-words">{value}</dd></div>
                ))}
              </dl>
            )}
          </Field>
          <Field label={t("seo.page.jsonLd")}>
            {facts.jsonLd.length === 0 ? <span className="text-muted-foreground">—</span> : (
              <ul className="grid gap-2">
                {facts.jsonLd.map((block, index) => (
                  <li key={index} className="grid gap-1">
                    <span className={cn("text-xs font-medium", block.error ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      {block.error ? `${t("seo.page.jsonLdError")} ${block.error}` : block.types.join(", ") || "—"}
                    </span>
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-xs">{formatted(block.source)}</pre>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </dl>
      ) : page.outcome === "FETCHED" && (page.status ?? 0) < 400 ? (
        <p className="text-sm text-muted-foreground">{t("seo.page.notHtml")}</p>
      ) : null}
    </div>
  );
}

export function PagePanel({ projectId, siteId, pageId, range, onClose }: {
  projectId: string;
  siteId: string;
  pageId: string;
  range: SeoRange;
  onClose: () => void;
}) {
  const page = useSeoAuditPage(projectId, siteId, pageId, range);
  const label = page.data?.url ?? t("seo.audit.title");
  return (
    <SidePanel label={label} testId="seo-page-panel" onClose={onClose}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-base font-semibold" title={label}>{label}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={t("seo.page.close")} onClick={onClose}><X className="size-4" /></Button>
      </header>
      {page.data ? <Details page={page.data} /> : <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
    </SidePanel>
  );
}
