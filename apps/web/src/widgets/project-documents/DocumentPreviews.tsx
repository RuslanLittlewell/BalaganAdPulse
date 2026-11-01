import { t } from "@/shared/config/index.js";
import type { DocumentSummary } from "@/entities/project-document/index.js";
import { formatAgo } from "./formatAgo.js";

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });

function Thumbnail({ document }: { document: DocumentSummary }) {
  return (
    <div aria-hidden className="relative h-32 overflow-hidden rounded-xl bg-linear-to-b from-primary/15 to-primary/5">
      <div className="absolute inset-x-8 top-4 bottom-0 translate-x-2 rounded-t-lg border border-border/60 bg-background/60" />
      <div className="absolute inset-x-6 top-6 bottom-0 rounded-t-lg border border-border bg-background px-4 pt-3 shadow-sm transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none">
        <p className="line-clamp-2 font-serif text-sm leading-snug text-foreground">{document.title}</p>
        <p className="mt-1 truncate text-[9px] text-muted-foreground">
          {[dayOf(document.updatedAt), document.updatedBy?.name].filter(Boolean).join(" · ")}
        </p>
        {document.excerpt ? (
          <p className="mt-2 line-clamp-4 whitespace-pre-line text-[9px] leading-relaxed text-muted-foreground">
            {document.excerpt}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DocumentPreviews({
  documents,
  onOpen,
}: {
  documents: readonly DocumentSummary[];
  onOpen: (documentId: string) => void;
}) {
  return (
    <ul aria-label={t("documents.previews")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => (
        <li key={document.id}>
          <button
            type="button"
            onClick={() => onOpen(document.id)}
            className="group flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-2 pb-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Thumbnail document={document} />
            <span className="flex min-w-0 flex-col px-2">
              <span className="truncate text-sm font-medium text-foreground">{document.title}</span>
              <span className="text-xs text-muted-foreground">{formatAgo(document.updatedAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
