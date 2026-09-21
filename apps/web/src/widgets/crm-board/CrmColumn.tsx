import type { ReactNode } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { leadColumnLabel, type Lead, type LeadColumn } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { accentOf } from "./accent.js";
import { LeadCard } from "./LeadCard.js";

export interface CrmColumnProps {
  column: LeadColumn;
  leads: Lead[];
  draggable?: boolean;
  draggingId?: string | null;
  actions?: ReactNode;
  onOpen?: (lead: Lead) => void;
}

export function CrmColumnPanel({
  column, leads, draggable = false, draggingId, actions, onOpen,
}: CrmColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const title = leadColumnLabel(column);

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-testid={`crm-column-${column.id}`}
      className={cn(
        "flex h-full min-h-0 w-80 shrink-0 flex-col rounded-xl border border-border",
        "bg-muted/30 shadow-sm transition-colors",
        isOver && "border-primary/40 bg-primary/5 shadow-md",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", accentOf(column.id))}
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight" title={title}>
          {title}
        </h2>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
          {leads.length}
        </span>
        {actions}
      </header>

      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              draggable={draggable}
              placeholder={lead.id === draggingId}
              onOpen={onOpen}
            />
          ))}

          {leads.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
              {t("crm.empty")}
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
