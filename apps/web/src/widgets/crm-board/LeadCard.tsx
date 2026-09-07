import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mail, Phone } from "lucide-react";
import type { Lead } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export interface LeadCardProps {
  lead: Lead;
  draggable?: boolean;
  placeholder?: boolean;
  onOpen?: (lead: Lead) => void;
}

interface Contact {
  key: string;
  value: string;
  href: string;
  icon: typeof Mail;
}

function contactsOf(lead: Lead): Contact[] {
  const contacts: Contact[] = [];
  if (lead.phone) contacts.push({ key: "phone", value: lead.phone, href: `tel:${lead.phone}`, icon: Phone });
  if (lead.email) contacts.push({ key: "email", value: lead.email, href: `mailto:${lead.email}`, icon: Mail });
  return contacts;
}

export function LeadCard({ lead, draggable = false, placeholder = false, onOpen }: LeadCardProps) {
  const contacts = contactsOf(lead);
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
            "absolute inset-y-0 left-0 grid w-5 place-items-center text-muted-foreground",
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

      {lead.company ? (
        <p className="truncate pt-0.5 text-xs text-muted-foreground" data-testid={`lead-company-${lead.id}`}>
          {lead.company}
        </p>
      ) : null}

      {contacts.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {contacts.map(({ key, value, href, icon: Icon }) => (
            <li key={key} className="flex min-w-0 items-center gap-1.5">
              <Icon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <a
                href={href}
                className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {value}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2.5">
        <span
          className="truncate text-[11px] text-muted-foreground/80"
          data-testid={`lead-source-${lead.id}`}
        >
          {lead.source ?? t("crm.noSource")}
        </span>
      </footer>
    </article>
  );
}
