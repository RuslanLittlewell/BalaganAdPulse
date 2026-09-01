import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  useAuditEvents,
  type AuditAction,
  type AuditEventFilters,
} from "@/entities/audit-event/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Loader,
} from "@/shared/ui/index.js";

export interface ActivityLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: AuditEventFilters;
}

const actionLabels: Record<AuditAction, string> = {
  CREATE: t("activity.action.CREATE"),
  UPDATE: t("activity.action.UPDATE"),
  DELETE: t("activity.action.DELETE"),
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ActivityList({ filters }: { filters: AuditEventFilters }) {
  const query = useAuditEvents(filters);
  const events = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <div className="grid place-items-center py-12"><Loader /></div>;
  if (query.isError) return <p className="py-8 text-center text-sm text-destructive">{t("activity.loadFailed")}</p>;
  if (events.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>;

  return (
    <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
      {events.map((event) => (
        <article key={event.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{event.actorName}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{actionLabels[event.action]}</span>
              </div>
              <p className="mt-1 text-sm">{event.summary}</p>
            </div>
            <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: ru })}
            </time>
          </div>
          {event.changes && event.changes.length > 0 && (
            <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
              {event.changes.map((change, index) => (
                <li key={`${change.field}-${index}`}>
                  <span className="font-medium text-foreground">{change.field}:</span>{" "}
                  {displayValue(change.before)} → {displayValue(change.after)}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? t("state.loading") : t("activity.more")}
        </Button>
      )}
    </div>
  );
}

export function ActivityLogModal({ open, onOpenChange, filters = {} }: ActivityLogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none">
        <DialogHeader><DialogTitle>{t("activity.title")}</DialogTitle></DialogHeader>
        {open && <ActivityList filters={filters} />}
      </DialogContent>
    </Dialog>
  );
}
