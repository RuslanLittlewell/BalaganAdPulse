import { useCan } from "@/features/permissions/index.js";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  FIXED_LEAD_COLUMNS,
  applyLeadMove,
  leadPreviewFor,
  resolveLeadDrop,
  useLeadColumns,
  useLeads,
  useMoveLead,
  type BoardCapabilities,
  type Lead,
  type LeadField,
} from "@/entities/lead/index.js";
import { AddLeadColumn } from "@/features/lead-column-management/index.js";
import { compareBy, visibleLeads, type ViewState } from "@/features/lead-view-options/index.js";
import { t } from "@/shared/config/index.js";
import { boardCollisionDetection, droppedBelow, landingOf, useDragPreview } from "@/shared/lib/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { boardPlacement } from "./boardPlacement.js";
import { CrmColumn } from "./CrmColumn.js";
import { LeadCard } from "./LeadCard.js";

export interface CrmBoardProps {
  boardKey?: string;
  busy?: boolean;
  capabilities?: BoardCapabilities;
  view: ViewState;
  fields: readonly LeadField[];
  selectedId?: string | null;
  creatingIn: string | null;
  onCreatingChange: (stage: string | null) => void;
  onOpen?: (lead: Lead) => void;
}

export function CrmBoard({
  boardKey, busy = false, capabilities, view, fields, selectedId, creatingIn, onCreatingChange, onOpen,
}: CrmBoardProps) {
  const { data: leads, isLoading, isError } = useLeads(boardKey);
  const { data: loadedColumns } = useLeadColumns(boardKey);
  const columns = loadedColumns ?? FIXED_LEAD_COLUMNS;
  const stages = useMemo(() => columns.map((column) => column.id), [columns]);
  const move = useMoveLead(boardKey ?? "");
  const [moveError, setMoveError] = useState<string | null>(null);
  const draggable = capabilities?.update ?? false;
  const managesBoard = useCan("create", "lead-board");

  const shown = useMemo(() => visibleLeads(leads ?? [], view, fields), [leads, view, fields]);
  const compare = useMemo(() => (view.sort ? compareBy(view.sort, fields) : null), [view.sort, fields]);
  const drag = useDragPreview(shown);
  const { board, draggingId, cancel: cancelDrag } = drag;

  useEffect(() => {
    cancelDrag();
    setMoveError(null);
  }, [boardKey, cancelDrag]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStage = useMemo(() => {
    const grouped = new Map<string, Lead[]>(stages.map((stage) => [stage, []]));
    for (const lead of board) grouped.get(lead.stage)?.push(lead);
    for (const stage of grouped.values()) stage.sort(compare ?? ((a, b) => a.position - b.position));
    return grouped;
  }, [board, stages, compare]);

  const storedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads ?? []) counts.set(lead.stage, (counts.get(lead.stage) ?? 0) + 1);
    return counts;
  }, [leads]);

  const dragging = board.find((lead) => lead.id === draggingId) ?? null;
  const loading = busy || isLoading;
  const shownColumns = view.hideEmpty
    ? columns.filter((column) => (byStage.get(column.id)?.length ?? 0) > 0 || column.id === creatingIn)
    : columns;

  if (isError && (leads ?? []).length === 0) return <EmptyState title={t("crm.loadFailed")} />;

  function handleDragStart(event: DragStartEvent) {
    drag.start(String(event.active.id));
    setMoveError(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const below = droppedBelow(active, over);
    drag.preview((current) => leadPreviewFor(current, String(active.id), String(over.id), stages, below));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const shownMove = resolveLeadDrop(shown, drag.previewed, activeId, overId, stages, compare ? null : landingOf(event.over));
    const placement = shownMove ? boardPlacement(activeId, shownMove, { all: leads ?? [], shown, sorted: compare !== null }) : null;
    if (!shownMove || !placement) {
      cancelDrag();
      return;
    }
    move.mutate(
      { id: activeId, body: placement },
      { onError: () => setMoveError(t("crm.moveFailed")), onSettled: drag.release },
    );
    drag.settle((current) => applyLeadMove(current, activeId, shownMove));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={cancelDrag}
    >
      {moveError ? <p role="alert" className="mb-2 text-sm text-destructive">{moveError}</p> : null}

      {loading ? (
        <div data-testid="crm-loading" className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/40">
          <span className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg"><Loader /></span>
        </div>
      ) : null}

      <div className="flex h-full min-h-0 overflow-x-auto">
        {shownColumns.map((column) => (
          <CrmColumn
            key={column.id}
            boardKey={boardKey}
            column={column}
            columns={columns}
            leads={byStage.get(column.id) ?? []}
            storedCount={storedCounts.get(column.id) ?? 0}
            fields={fields}
            cardFields={view.cardFields}
            compact={view.compact}
            capabilities={capabilities}
            draggable={draggable}
            draggingId={draggingId}
            selectedId={selectedId}
            onOpen={onOpen}
            onStartCreate={() => onCreatingChange(column.id)}
          />
        ))}

        {boardKey && managesBoard && capabilities?.create && loadedColumns ? (
          <div className="shrink-0 px-2 py-2"><AddLeadColumn boardKey={boardKey} columns={columns} /></div>
        ) : null}
      </div>

      {createPortal(
        <DragOverlay>
          {dragging ? (
            <div className="w-60 cursor-grabbing opacity-95 shadow-xl">
              <LeadCard lead={dragging} fields={fields} cardFields={view.cardFields} compact={view.compact} />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
