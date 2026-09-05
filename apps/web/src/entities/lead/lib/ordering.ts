import { LEAD_STAGES, type Lead, type LeadMove, type LeadStage } from "../api/api.js";

function isStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

export function applyLeadMove(board: Lead[], id: string, move: LeadMove): Lead[] {
  const moved = board.find((lead) => lead.id === id);
  if (!moved) return board;

  const source = board
    .filter((lead) => lead.stage === moved.stage && lead.id !== id)
    .sort((a, b) => a.position - b.position);
  const target = board
    .filter((lead) => lead.stage === move.stage && lead.id !== id)
    .sort((a, b) => a.position - b.position);

  const at = Math.max(0, Math.min(move.position, target.length));
  const placed = [...target.slice(0, at), { ...moved, stage: move.stage }, ...target.slice(at)];

  const placements = new Map<string, { stage: LeadStage; position: number }>();
  source.forEach((lead, index) => placements.set(lead.id, { stage: moved.stage, position: index }));
  placed.forEach((lead, index) => placements.set(lead.id, { stage: move.stage, position: index }));

  let changed = false;
  const next = board.map((lead) => {
    const placement = placements.get(lead.id);
    if (!placement
      || (lead.stage === placement.stage && lead.position === placement.position)) return lead;
    changed = true;
    return { ...lead, ...placement };
  });
  return changed ? next : board;
}

export function leadPlacementFor(board: Lead[], activeId: string, overId: string): LeadMove | null {
  const active = board.find((lead) => lead.id === activeId);
  if (!active) return null;

  const stageOf = (stage: LeadStage) =>
    board.filter((lead) => lead.stage === stage).sort((a, b) => a.position - b.position);

  if (isStage(overId)) {
    return { stage: overId, position: stageOf(overId).filter((lead) => lead.id !== activeId).length };
  }

  const over = board.find((lead) => lead.id === overId);
  if (!over) return null;

  const index = stageOf(over.stage).findIndex((lead) => lead.id === overId);
  return { stage: over.stage, position: index < 0 ? stageOf(over.stage).length : index };
}

export function leadPreviewFor(board: Lead[], activeId: string, overId: string): Lead[] {
  const active = board.find((lead) => lead.id === activeId);
  if (!active) return board;

  const placement = leadPlacementFor(board, activeId, overId);
  if (!placement || placement.stage === active.stage) return board;

  return applyLeadMove(board, activeId, placement);
}

export function resolveLeadDrop(
  server: Lead[],
  preview: Lead[] | null,
  activeId: string,
  overId: string | null,
): LeadMove | null {
  const original = server.find((lead) => lead.id === activeId);
  if (!original) return null;

  const previewed = preview?.find((lead) => lead.id === activeId);
  if (previewed && (previewed.stage !== original.stage || previewed.position !== original.position)) {
    return { stage: previewed.stage, position: previewed.position };
  }

  if (!overId) return null;
  const placement = leadPlacementFor(server, activeId, overId);
  if (!placement) return null;
  if (placement.stage === original.stage && placement.position === original.position) return null;
  return placement;
}
