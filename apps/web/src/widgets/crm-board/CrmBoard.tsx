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
  FIXED_LEAD_COLUMNS,
  leadPreviewFor,
  resolveLeadDrop,
  useLeadColumns,
  useLeads,
  useMoveLead,
  type BoardCapabilities,
  type Lead,
} from "@/entities/lead/index.js";
import { AddLeadColumn, LeadColumnMenu } from "@/features/lead-column-management/index.js";
import { t } from "@/shared/config/index.js";
import { boardCollisionDetection } from "@/shared/lib/index.js";
import { EmptyState, Loader } from "@/shared/ui/index.js";
import { CrmColumnPanel } from "./CrmColumn.js";
import { LeadCard } from "./LeadCard.js";

export interface CrmBoardProps {
  boardKey?: string;
  busy?: boolean;
  draggable?: boolean;
  capabilities?: BoardCapabilities;
  onOpen?: (lead: Lead) => void;
}

export function CrmBoard({ boardKey, busy = false, draggable = false, capabilities, onOpen }: CrmBoardProps) {
  const { data: leads, isLoading, isError } = useLeads(boardKey);
  const { data: loadedColumns } = useLeadColumns(boardKey);
  const columns = loadedColumns ?? FIXED_LEAD_COLUMNS;
  const stages = useMemo(() => columns.map((column) => column.id), [columns]);
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
    const grouped = new Map<string, Lead[]>(stages.map((stage) => [stage, []]));
    for (const lead of board) grouped.get(lead.stage)?.push(lead);
    for (const stage of grouped.values()) stage.sort((a, b) => a.position - b.position);
    return grouped;
  }, [board, stages]);

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
    setPreview((current) => leadPreviewFor(current ?? board, String(active.id), String(over.id), stages));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const placement = resolveLeadDrop(leads ?? [], preview, activeId, overId, stages);

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
        {columns.map((column) => (
          <CrmColumnPanel
            key={column.id}
            column={column}
            leads={byStage.get(column.id) ?? []}
            draggable={draggable}
            draggingId={draggingId}
            onOpen={onOpen}
            actions={
              boardKey && capabilities && column.kind === "CUSTOM" && (capabilities.update || capabilities.delete) ? (
                <LeadColumnMenu
                  boardKey={boardKey}
                  column={column}
                  columns={columns}
                  leadCount={byStage.get(column.id)?.length ?? 0}
                  capabilities={capabilities}
                />
              ) : null
            }
          />
        ))}

        {boardKey && capabilities?.create && loadedColumns ? (
          <AddLeadColumn boardKey={boardKey} columns={columns} />
        ) : null}
      </div>

      <DragOverlay>
        {dragging ? <LeadCardOverlay lead={dragging} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function LeadCardOverlay({ lead }: { lead: Lead }) {
  return <div className="w-80 cursor-grabbing opacity-95 shadow-xl"><LeadCard lead={lead} /></div>;
}
