import { LEAD_STAGES, type Lead, type LeadMove } from "../api/api.js";

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

  const placements = new Map<string, { stage: string; position: number }>();
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

export function leadPlacementFor(
  board: Lead[],
  activeId: string,
  overId: string,
  stages: readonly string[] = LEAD_STAGES,
  below = false,
): LeadMove | null {
  const active = board.find((lead) => lead.id === activeId);
  if (!active) return null;

  const stageOf = (stage: string) =>
    board.filter((lead) => lead.stage === stage).sort((a, b) => a.position - b.position);

  if (stages.includes(overId)) {
    return { stage: overId, position: stageOf(overId).filter((lead) => lead.id !== activeId).length };
  }

  const over = board.find((lead) => lead.id === overId);
  if (!over) return null;

  const index = stageOf(over.stage).findIndex((lead) => lead.id === overId);
  if (index < 0) return { stage: over.stage, position: stageOf(over.stage).length };
  return { stage: over.stage, position: below && over.stage !== active.stage ? index + 1 : index };
}

export function leadPreviewFor(
  board: Lead[],
  activeId: string,
  overId: string,
  stages: readonly string[] = LEAD_STAGES,
  below = false,
): Lead[] {
  const active = board.find((lead) => lead.id === activeId);
  if (!active) return board;

  const placement = leadPlacementFor(board, activeId, overId, stages, below);
  if (!placement || placement.stage === active.stage) return board;

  return applyLeadMove(board, activeId, placement);
}

export function resolveLeadDrop(
  server: Lead[],
  preview: Lead[] | null,
  activeId: string,
  overId: string | null,
  stages: readonly string[] = LEAD_STAGES,
  landing: { readonly container: string; readonly index: number } | null = null,
): LeadMove | null {
  const original = server.find((lead) => lead.id === activeId);
  if (!original) return null;

  if (landing && stages.includes(landing.container)) {
    const shownAt = server
      .filter((lead) => lead.stage === original.stage)
      .sort((a, b) => a.position - b.position)
      .findIndex((lead) => lead.id === activeId);
    const unmoved = landing.container === original.stage && landing.index === shownAt;
    return unmoved ? null : { stage: landing.container, position: landing.index };
  }

  const previewed = preview?.find((lead) => lead.id === activeId);
  if (previewed && (previewed.stage !== original.stage || previewed.position !== original.position)) {
    return { stage: previewed.stage, position: previewed.position };
  }

  if (!overId) return null;
  const placement = leadPlacementFor(server, activeId, overId, stages);
  if (!placement) return null;
  if (placement.stage === original.stage && placement.position === original.position) return null;
  return placement;
}
