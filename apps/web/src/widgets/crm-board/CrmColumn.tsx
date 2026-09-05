import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Lead, LeadStage } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { LeadCard } from "./LeadCard.js";

export interface CrmColumnProps {
  stage: LeadStage;
  leads: Lead[];
  draggable?: boolean;
  draggingId?: string | null;
  onOpen?: (lead: Lead) => void;
}

const ACCENT: Record<LeadStage, string> = {
  NEW: "bg-slate-400",
  CONTACTED: "bg-sky-500",
  QUALIFIED: "bg-cyan-500",
  PROPOSAL: "bg-violet-500",
  NEGOTIATION: "bg-amber-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-500",
  DEFERRED: "bg-zinc-400",
};

export function CrmColumnPanel({
  stage, leads, draggable = false, draggingId, onOpen,
}: CrmColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      aria-label={t(`crm.stage.${stage}`)}
      data-testid={`crm-column-${stage}`}
      className={cn(
        "flex h-full min-h-0 w-80 shrink-0 flex-col rounded-xl border border-border",
        "bg-muted/30 shadow-sm transition-colors",
        isOver && "border-primary/40 bg-primary/5 shadow-md",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", ACCENT[stage])} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          {t(`crm.stage.${stage}`)}
        </h2>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
          {leads.length}
        </span>
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
