import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ScanSearchIcon } from "lucide-react";
import { formatCount, formatDateTime } from "@/shared/lib/index.js";
import { cn } from "@/shared/lib/utils.js";
import { t } from "@/shared/config/index.js";
import { Button, Skeleton } from "@/shared/ui/index.js";
import { seoApi, seoSiteKey, seoSitesKey, useSeoAudit, useSeoAuditPages, type SeoProblemKind, type SeoSeverity } from "@/entities/seo/index.js";
import { seoFailureOf, seoFailureText } from "@/features/seo-integration/index.js";

const SEVERITY_TEXT: Record<SeoSeverity, string> = {
  ERROR: "text-red-600 dark:text-red-400",
  WARNING: "text-amber-600 dark:text-amber-400",
};

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col rounded-md bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", tone)}>{formatCount(value)}</dd>
    </div>
  );
}

function KindPages({ projectId, siteId, kind, onBack, onOpenPage }: {
  projectId: string;
  siteId: string;
  kind: SeoProblemKind;
  onBack: () => void;
  onOpenPage: (pageId: string) => void;
}) {
  const pages = useSeoAuditPages(projectId, siteId, kind);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon />
          {t("seo.audit.back")}
        </Button>
        <h4 className="text-sm font-semibold">{t(`seo.problem.${kind}`)}</h4>
      </div>
      {!pages.data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul aria-label={t(`seo.problem.${kind}`)} className="flex flex-col">
          {pages.data.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => onOpenPage(page.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 truncate">{page.url}</span>
                {page.status !== null ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{page.status}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AuditBlock({ projectId, siteId, canCheck, onOpenPage }: {
  projectId: string;
  siteId: string;
  canCheck: boolean;
  onOpenPage: (pageId: string) => void;
}) {
  const queryClient = useQueryClient();
  const audit = useSeoAudit(projectId, siteId);
  const [kind, setKind] = useState<SeoProblemKind | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const running = audit.data?.status === "QUEUED" || audit.data?.status === "RUNNING";
  const result = audit.data?.result ?? null;

  const checkNow = async () => {
    setPending(true);
    setFailure(null);
    try {
      await seoApi.check(projectId, siteId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...seoSiteKey(projectId, siteId), "audit"] }),
        queryClient.invalidateQueries({ queryKey: seoSitesKey(projectId) }),
      ]);
    } catch (error) {
      setFailure(seoFailureOf(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label={t("seo.audit.title")} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-foreground">{t("seo.audit.title")}</h3>
          {result ? <p className="text-xs text-muted-foreground">{t("seo.audit.at")} {formatDateTime(result.finishedAt)}</p> : null}
        </div>
        {canCheck ? (
          <Button type="button" variant="outline" size="sm" disabled={pending || running} aria-busy={pending || running} onClick={() => void checkNow()}>
            <ScanSearchIcon className={running ? "animate-pulse" : undefined} />
            {t("seo.audit.run")}
          </Button>
        ) : null}
      </div>
      {running ? <p role="status" className="text-xs text-muted-foreground">{t("seo.audit.running")}</p> : null}
      {audit.data?.status === "ERROR" && audit.data.checkError ? (
        <p role="alert" className="text-xs text-destructive">
          {audit.data.checkError === "UNREACHABLE" || audit.data.checkError === "ROBOTS"
            ? seoFailureText(audit.data.checkError)
            : t("seo.error.check")}
        </p>
      ) : null}
      {failure ? <p role="alert" className="text-xs text-destructive">{failure}</p> : null}
      {!audit.data ? (
        <Skeleton className="h-24 w-full" />
      ) : !result ? (
        running ? null : <p className="text-sm text-muted-foreground">{t("seo.audit.noResult")}</p>
      ) : kind ? (
        <KindPages projectId={projectId} siteId={siteId} kind={kind} onBack={() => setKind(null)} onOpenPage={onOpenPage} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count label={t("seo.audit.checked")} value={result.checked} />
            <Count label={t("seo.audit.errors")} value={result.pagesWithErrors} tone={result.pagesWithErrors > 0 ? SEVERITY_TEXT.ERROR : undefined} />
            <Count label={t("seo.audit.warnings")} value={result.pagesWithWarnings} tone={result.pagesWithWarnings > 0 ? SEVERITY_TEXT.WARNING : undefined} />
            <Count label={t("seo.audit.notChecked")} value={result.notChecked} />
          </dl>
          {result.kinds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("seo.audit.none")}</p>
          ) : (
            <ul aria-label={t("seo.page.problems")} className="flex flex-col">
              {result.kinds.map((entry) => (
                <li key={entry.kind}>
                  <button
                    type="button"
                    onClick={() => setKind(entry.kind)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("shrink-0 text-xs font-medium", SEVERITY_TEXT[entry.severity])}>{t(`seo.severity.${entry.severity}`)}</span>
                      <span className="truncate">{t(`seo.problem.${entry.kind}`)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatCount(entry.pages)} {t("seo.audit.pages")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("seo.audit.html")}</p>
        </>
      )}
    </section>
  );
}
