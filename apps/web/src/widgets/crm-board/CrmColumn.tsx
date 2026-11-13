import { useCan } from "@/features/permissions/index.js";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  ColumnPill,
  compactSum,
  leadColumnLabel,
  type BoardCapabilities,
  type Lead,
  type LeadColumn,
  type LeadField,
} from "@/entities/lead/index.js";
import { LeadColumnMenu } from "@/features/lead-column-management/index.js";
import type { FieldRef } from "@/features/lead-view-options/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button } from "@/shared/ui/index.js";
import { LeadCard } from "./LeadCard.js";

export interface CrmColumnProps {
  boardKey?: string;
  column: LeadColumn;
  columns: readonly LeadColumn[];
  leads: Lead[];
  storedCount: number;
  fields: readonly LeadField[];
  cardFields: readonly FieldRef[];
  compact: boolean;
  capabilities?: BoardCapabilities;
  draggable?: boolean;
  draggingId?: string | null;
  selectedId?: string | null;
  onOpen?: (lead: Lead) => void;
  onStartCreate: () => void;
}

function amountSum(leads: readonly Lead[]): number | null {
  const amounts = leads.flatMap((lead) => (lead.amount ? [Number(lead.amount)] : []));
  return amounts.length === 0 ? null : amounts.reduce((total, amount) => total + amount, 0);
}

export function CrmColumn({
  boardKey, column, columns, leads, storedCount, fields, cardFields, compact, capabilities, draggable = false,
  draggingId, selectedId, onOpen, onStartCreate,
}: CrmColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const title = leadColumnLabel(column);
  const sum = amountSum(leads);
  const managesBoard = useCan("update", "lead-board");
  const manages = managesBoard && Boolean(boardKey && capabilities && column.kind === "CUSTOM" && (capabilities.update || capabilities.delete));

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-testid={`crm-column-${column.id}`}
      data-color={column.color}
      className={cn(
        "flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-border/60 px-2 transition-colors last:border-r-0",
        isOver && "bg-muted/40",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 py-2">
        <ColumnPill name={title} color={column.color} />
        <span className="text-xs tabular-nums text-muted-foreground" data-testid={`crm-count-${column.id}`}>{leads.length}</span>
        {sum !== null ? (
          <span className="text-xs tabular-nums text-muted-foreground" title={t("crm.columnSum")} data-testid={`crm-sum-${column.id}`}>
            {compactSum(sum)}
          </span>
        ) : null}
        <span className="flex-1" />
        {manages && boardKey && capabilities ? (
          <LeadColumnMenu boardKey={boardKey} column={column} columns={columns} leadCount={storedCount} capabilities={capabilities} />
        ) : null}
      </header>

      <SortableContext id={column.id} items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              fields={fields}
              cardFields={cardFields}
              compact={compact}
              draggable={draggable}
              placeholder={lead.id === draggingId}
              selected={lead.id === selectedId}
              onOpen={onOpen}
            />
          ))}

          {boardKey && capabilities?.create ? (
              <Button
                type="button"
                variant="ghost"
                aria-label={`${t("crm.addLeadIn")} ${title}`}
                className="h-7 justify-start gap-1 px-1.5 text-xs font-normal text-muted-foreground"
                onClick={onStartCreate}
              >
                <Plus aria-hidden className="size-3" />
                {t("crm.newLead")}
              </Button>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
