import type { CSSProperties } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  PRESENCE_ACTIONS,
  describeAuditEvent,
  useAuditEvents,
  type AuditAction,
  type AuditEvent,
  type AuditEventFilters,
} from "@/entities/audit-event/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Loader } from "@/shared/ui/index.js";
import { groupByDay } from "./days.js";

const actionLabels: Record<AuditAction, string> = {
  CREATE: t("activity.action.CREATE"),
  UPDATE: t("activity.action.UPDATE"),
  DELETE: t("activity.action.DELETE"),
  ONLINE: t("activity.action.ONLINE"),
  OFFLINE: t("activity.action.OFFLINE"),
};

const tones: Record<AuditAction, string> = {
  CREATE: "var(--activity-create)",
  UPDATE: "var(--activity-update)",
  DELETE: "var(--activity-delete)",
  ONLINE: "var(--activity-online)",
  OFFLINE: "var(--activity-offline)",
};

const toneOf = (action: AuditAction) => ({ "--tone": tones[action] }) as CSSProperties;

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ActionBadge({ action }: { action: AuditAction }) {
  return (
    <span
      style={toneOf(action)}
      className="rounded-full bg-[color-mix(in_oklab,var(--tone)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--tone)]"
    >
      {actionLabels[action]}
    </span>
  );
}

function EventTime({ at }: { at: string }) {
  return (
    <time
      className="shrink-0 text-xs tabular-nums text-muted-foreground"
      dateTime={at}
      title={formatDistanceToNow(new Date(at), { addSuffix: true, locale: ru })}
    >
      {format(new Date(at), "HH:mm")}
    </time>
  );
}

function Marker({ action }: { action: AuditAction }) {
  return (
    <span
      aria-hidden
      style={toneOf(action)}
      className="absolute -left-[5px] top-[0.6rem] size-[9px] rounded-full bg-[var(--tone)]"
    />
  );
}

function PresenceItem({ event }: { event: AuditEvent }) {
  return (
    <li data-action={event.action} className="relative py-1.5 pl-5">
      <Marker action={event.action} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-medium">{event.actorName}</span>
          <ActionBadge action={event.action} />
        </div>
        <EventTime at={event.createdAt} />
      </div>
    </li>
  );
}

function ChangeItem({ event, projectName }: { event: AuditEvent; projectName: string | null }) {
  const described = describeAuditEvent(event);
  const name = described?.name ?? (event.entityType === "project" ? projectName : null);
  const context = projectName && name !== projectName ? projectName : null;
  const changes = Array.isArray(event.changes) ? event.changes : [];

  return (
    <li data-action={event.action} className="relative py-2 pl-5">
      <Marker action={event.action} />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm leading-snug">
          {described ? (
            <>
              <span className="font-medium">{described.subject}</span>
              {name && <span> «{name}»</span>}
              {described.detail && <span className="text-muted-foreground"> · {described.detail}</span>}
            </>
          ) : (
            event.summary
          )}
        </p>
        <EventTime at={event.createdAt} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <ActionBadge action={event.action} />
        <span>{event.actorName}</span>
        {context && <span>· {context}</span>}
      </div>
      {changes.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {changes.map((change, index) => (
            <li key={`${change.field}-${index}`}>
              <span className="font-medium text-foreground">{change.field}:</span>{" "}
              {displayValue(change.before)} → {displayValue(change.after)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ActivityList({ filters, projectNames }: {
  filters: AuditEventFilters;
  projectNames: ReadonlyMap<string, string>;
}) {
  const query = useAuditEvents(filters);
  const events = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <div className="grid flex-1 place-items-center"><Loader /></div>;
  if (query.isError) return <p className="flex-1 py-8 text-center text-sm text-destructive">{t("activity.loadFailed")}</p>;
  if (events.length === 0) return <p className="flex-1 py-8 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {groupByDay(events, new Date()).map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <ol className="ml-5 border-l border-border">
            {group.events.map((event) => PRESENCE_ACTIONS.includes(event.action)
              ? <PresenceItem key={event.id} event={event} />
              : (
                <ChangeItem
                  key={event.id}
                  event={event}
                  projectName={event.projectId && !filters.projectId ? projectNames.get(event.projectId) ?? null : null}
                />
              ))}
          </ol>
        </section>
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
