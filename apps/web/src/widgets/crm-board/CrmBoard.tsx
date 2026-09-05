import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  LEAD_STAGES,
  leadPreviewFor,
  resolveLeadDrop,
  useLeads,
  useMoveLead,
  type Lead,
  type LeadStage,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { boardCollisionDetection } from "@/shared/lib/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { CrmColumnPanel } from "./CrmColumn.js";

export interface CrmBoardProps {
  boardKey?: string;
  busy?: boolean;
  draggable?: boolean;
  onOpen?: (lead: Lead) => void;
}

export function CrmBoard({ boardKey, busy = false, draggable = false, onOpen }: CrmBoardProps) {
  const { data: leads, isLoading, isError } = useLeads(boardKey);
  const move = useMoveLead(boardKey ?? "");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Lead[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { if (!draggingId) setPreview(null); }, [draggingId, leads]);
  useEffect(() => { setPreview(null); setDraggingId(null); setMoveError(null); }, [boardKey]);

  const board = preview ?? leads ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStage = useMemo(() => {
    const grouped = new Map<LeadStage, Lead[]>(LEAD_STAGES.map((stage) => [stage, []]));
    for (const lead of board) grouped.get(lead.stage)?.push(lead);
    for (const stage of grouped.values()) stage.sort((a, b) => a.position - b.position);
    return grouped;
  }, [board]);

  const dragging = board.find((lead) => lead.id === draggingId) ?? null;
  const loading = busy || isLoading;

  if (isError && board.length === 0) return <EmptyState title={t("crm.loadFailed")} />;

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setPreview(leads ?? []);
    setMoveError(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    setPreview((current) => leadPreviewFor(current ?? board, String(active.id), String(over.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const placement = resolveLeadDrop(leads ?? [], preview, activeId, overId);

    setDraggingId(null);
    if (!placement) { setPreview(null); return; }

    move.mutate(
      { id: activeId, body: placement },
      { onError: () => setMoveError(t("crm.moveFailed")) },
    );
    setPreview(null);
  }

  function handleDragCancel() {
    setDraggingId(null);
    setPreview(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {moveError ? (
        <p role="alert" className="mb-2 text-sm text-destructive">{moveError}</p>
      ) : null}

      {loading ? (
        <div
          data-testid="crm-loading"
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/40"
        >
          <span className="rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
            <Loader />
          </span>
        </div>
      ) : null}

      <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-2">
        {LEAD_STAGES.map((stage) => (
          <CrmColumnPanel
            key={stage}
            stage={stage}
            leads={byStage.get(stage) ?? []}
            draggable={draggable}
            draggingId={draggingId}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay>
        {dragging ? <LeadCardOverlay lead={dragging} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function LeadCardOverlay({ lead }: { lead: Lead }) {
  return (
    <article className="rounded-xl border border-border bg-card px-3 py-3 shadow-md">
      <h3 className="truncate text-sm font-medium leading-snug">{lead.name}</h3>
    </article>
  );
}
