import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderKanban, GripVertical, Mail } from "lucide-react";
import type { Lead } from "@/entities/lead/index.js";
import { MemberAvatar } from "@/entities/membership/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { accentOf } from "./accent.js";

export interface LeadCardProps {
  lead: Lead;
  draggable?: boolean;
  placeholder?: boolean;
  onOpen?: (lead: Lead) => void;
}

function sourceLabel(lead: Lead): string {
  if (lead.source) return lead.source;
  if (lead.metaSource) return `${t("crm.source.meta")} · ${lead.metaSource.campaign.name}`;
  return t("crm.noSource");
}

export function LeadCard({ lead, draggable = false, placeholder = false, onOpen }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: lead.id,
    disabled: !draggable,
  });

  const { onKeyDown: startKeyboardDrag, ...pointerListeners } = listeners ?? {};
  const onHandleKeyDown = startKeyboardDrag as React.KeyboardEventHandler<HTMLButtonElement> | undefined;

  function open() {
    onOpen?.(lead);
  }

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border border-border bg-card",
        "py-3 pl-6 pr-3 text-left",
        "shadow-sm transition-all hover:border-border hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        onOpen && "cursor-pointer",
        draggable && "cursor-grab active:cursor-grabbing",
        placeholder && "border-dashed opacity-40 shadow-none",
      )}
      data-testid={`lead-card-${lead.id}`}
      data-draggable={draggable ? "true" : undefined}
      data-placeholder={placeholder ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${t("crm.open")}: ${lead.name}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      }}
      {...(draggable ? pointerListeners : {})}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 transition-opacity group-hover:opacity-0",
          accentOf(lead.stage),
        )}
      />

      {draggable ? (
        <button
          type="button"
          aria-label={t("crm.drag")}
          data-testid={`lead-drag-${lead.id}`}
          className={cn(
            "absolute inset-y-0 left-0 grid w-6 cursor-grab place-items-center text-muted-foreground active:cursor-grabbing",
            "opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onHandleKeyDown}
          {...attributes}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}

      <h3 className="min-w-0 truncate text-sm font-medium leading-snug">{lead.name}</h3>

      <div className="mt-3 grid min-w-0 gap-2 text-xs">
        <p className="flex min-w-0 items-center gap-2" data-testid={`lead-project-${lead.id}`}>
          <FolderKanban aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="w-16 shrink-0 text-muted-foreground">{t("crm.form.project")}</span>
          <span className="truncate font-medium">{lead.project?.name ?? t("crm.form.noProject")}</span>
        </p>
        {lead.email ? (
          <p className="flex min-w-0 items-center gap-2">
            <Mail aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="w-16 shrink-0 text-muted-foreground">{t("crm.form.email")}</span>
            <a href={`mailto:${lead.email}`} className="truncate hover:underline" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
              {lead.email}
            </a>
          </p>
        ) : null}
      </div>

      <footer className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span
          className="truncate text-[11px] text-muted-foreground/80"
          data-testid={`lead-source-${lead.id}`}
        >
          {sourceLabel(lead)}
        </span>
        {lead.assignee ? (
          <span className="flex min-w-0 items-center gap-2" data-testid={`lead-assignee-${lead.id}`} title={lead.assignee.name}>
            <MemberAvatar member={lead.assignee} size="sm" />
            <span className="max-w-28 truncate text-xs font-medium">{lead.assignee.name}</span>
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">{t("crm.form.unassigned")}</span>
        )}
      </footer>
    </article>
  );
}
