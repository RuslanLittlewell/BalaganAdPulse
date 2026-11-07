import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { LetterAvatar, type Lead, type LeadField } from "@/entities/lead/index.js";
import type { FieldRef } from "@/features/lead-view-options/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { cardRows } from "./cardRows.js";

export interface LeadCardProps {
  lead: Lead;
  fields?: readonly LeadField[];
  cardFields?: readonly FieldRef[];
  compact?: boolean;
  draggable?: boolean;
  placeholder?: boolean;
  selected?: boolean;
  onOpen?: (lead: Lead) => void;
}

export function LeadCard({
  lead, fields = [], cardFields = [], compact = false, draggable = false, placeholder = false, selected = false, onOpen,
}: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id, disabled: !draggable });
  const rows = compact ? [] : cardRows(lead, cardFields, fields);
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
        "group relative shrink-0 rounded-md border border-border bg-card py-1.5 pl-2 pr-2 text-left text-xs transition-[border-color,box-shadow,opacity]",
        "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        onOpen && "cursor-pointer",
        draggable && "cursor-grab active:cursor-grabbing",
        selected && "border-primary/60 ring-1 ring-primary/40",
        placeholder && "border-dashed opacity-40",
      )}
      data-testid={`lead-card-${lead.id}`}
      data-draggable={draggable ? "true" : undefined}
      data-placeholder={placeholder ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${t("crm.open")}: ${lead.name}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
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
          className="absolute inset-y-0 -left-0.5 grid w-3 cursor-grab place-items-center text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onHandleKeyDown}
          {...attributes}
        >
          <GripVertical aria-hidden className="size-3" />
        </button>
      ) : null}
      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-medium leading-snug">
        <LetterAvatar name={lead.name} />
        <span className="truncate">{lead.name}</span>
      </h3>

      {rows.length > 0 ? (
        <dl className="mt-1.5 flex min-w-0 flex-col gap-1">
          {rows.map(({ ref, label, icon: Icon, value }) => (
            <div key={ref} data-field={ref} className="flex min-h-5 min-w-0 items-center gap-2 text-muted-foreground">
              <dt className="shrink-0">
                <Icon aria-hidden className="size-3.5" />
                <span className="sr-only">{label}</span>
              </dt>
              <dd className="flex min-w-0 items-center text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
