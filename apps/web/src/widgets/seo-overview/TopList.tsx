import { formatCount } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Skeleton } from "@/shared/ui/index.js";
import { useSeoTop, type SeoRange, type SeoTopItem, type SeoTopKind } from "@/entities/seo/index.js";
import { percent, position, shortDate } from "./format.js";

const TOP_LIMIT = 100;

function pathOf(address: string): string {
  if (!URL.canParse(address)) return address;
  const url = new URL(address);
  return `${url.pathname}${url.search}` || "/";
}

function Item({ kind, item, onOpen }: { kind: SeoTopKind; item: SeoTopItem; onOpen?: () => void }) {
  const name = kind === "page" ? pathOf(item.key) : item.key;
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-foreground" title={item.key}>{name}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(item.clicks)}</span>
      </span>
      <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (item.share ?? 0) * 100)}%` }} />
      </span>
      <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>{t("seo.metric.impressions")} {formatCount(item.impressions)}</span>
        <span>{t("seo.metric.ctr")} {percent(item.ctr)}</span>
        <span>{t("seo.metric.position")} {position(item.position)}</span>
        <span>{t("seo.top.share")} {percent(item.share)}</span>
      </span>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {body}
        </button>
      ) : (
        <div className="flex flex-col gap-1 px-2 py-1.5">{body}</div>
      )}
    </li>
  );
}

export function TopList({
  projectId,
  siteId,
  kind,
  range,
  checkedPages,
  onOpenPage,
}: {
  projectId: string;
  siteId: string;
  kind: SeoTopKind;
  range: SeoRange;
  checkedPages?: ReadonlyMap<string, string>;
  onOpenPage?: (pageId: string) => void;
}) {
  const top = useSeoTop(projectId, siteId, kind, range, TOP_LIMIT);
  const title = t(kind === "query" ? "seo.top.queries" : "seo.top.pages");
  const items = top.data?.items ?? [];
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {top.data?.partial ? <p className="text-xs text-muted-foreground">{t("seo.top.partial")} {shortDate(top.data.from)}</p> : null}
      {!top.data ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(kind === "query" ? "seo.top.emptyQueries" : "seo.top.emptyPages")}</p>
      ) : (
        <ol tabIndex={0} className="flex max-h-[32rem] flex-col overflow-y-auto overscroll-contain rounded-md pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {items.map((item) => {
            const pageId = kind === "page" ? checkedPages?.get(item.key) : undefined;
            return <Item key={item.key} kind={kind} item={item} onOpen={pageId && onOpenPage ? () => onOpenPage(pageId) : undefined} />;
          })}
        </ol>
      )}
    </section>
  );
}
