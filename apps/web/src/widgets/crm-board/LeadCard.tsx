import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderKanban, GripVertical, Mail } from "lucide-react";
import type { Lead } from "@/entities/lead/index.js";
import { MemberAvatar } from "@/entities/membership/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export interface LeadCardProps {
  lead: Lead;
  draggable?: boolean;
  placeholder?: boolean;
  onOpen?: (lead: Lead) => void;
}

const SHOWN_TAGS = 3;

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
        "group relative shrink-0 overflow-hidden rounded-xl border border-border glass-card",
        "py-2 pl-5 pr-2 text-left",
        "shadow-sm transition-[border-color,box-shadow,opacity] hover:border-border hover:shadow-md",
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
      {draggable ? (
        <button
          type="button"
          aria-label={t("crm.drag")}
          data-testid={`lead-drag-${lead.id}`}
          className={cn(
            "absolute inset-y-0 left-0 grid w-5 cursor-grab place-items-center text-muted-foreground active:cursor-grabbing",
            "opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onHandleKeyDown}
          {...attributes}
        >
          <GripVertical aria-hidden className="size-3" />
        </button>
      ) : null}

      <h3 className="min-w-0 truncate text-sm font-medium leading-snug">{lead.name}</h3>

      <div className="mt-2 grid min-w-0 gap-2 text-xs">
        <p className="flex min-w-0 items-center gap-2" data-testid={`lead-project-${lead.id}`}>
          <FolderKanban aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <span className="w-13 shrink-0 text-muted-foreground">{t("crm.form.project")}</span>
          <span className="truncate font-medium">{lead.project.name}</span>
        </p>
        {lead.email ? (
          <p className="flex min-w-0 items-center gap-2">
            <Mail aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            <span className="w-13 shrink-0 text-muted-foreground">{t("crm.form.email")}</span>
            <a href={`mailto:${lead.email}`} className="truncate hover:underline" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
              {lead.email}
            </a>
          </p>
        ) : null}
      </div>

      <footer className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-2">
        {lead.tags.length > 0 ? (
          <span className="flex min-w-0 items-center gap-1" data-testid={`lead-tags-${lead.id}`}>
            {lead.tags.slice(0, SHOWN_TAGS).map((tag) => (
              <span key={tag} className="truncate rounded-md bg-primary/10 px-1 py-0.5 text-2xs font-medium text-primary">
                {tag}
              </span>
            ))}
            {lead.tags.length > SHOWN_TAGS ? (
              <span className="shrink-0 text-2xs text-muted-foreground">+{lead.tags.length - SHOWN_TAGS}</span>
            ) : null}
          </span>
        ) : <span />}
        {lead.assignee ? (
          <span className="flex min-w-0 items-center gap-2" data-testid={`lead-assignee-${lead.id}`} title={lead.assignee.name}>
            <MemberAvatar member={lead.assignee} size="sm" />
            <span className="max-w-22 truncate text-xs font-medium">{lead.assignee.name}</span>
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">{t("crm.form.unassigned")}</span>
        )}
      </footer>
    </article>
  );
}
