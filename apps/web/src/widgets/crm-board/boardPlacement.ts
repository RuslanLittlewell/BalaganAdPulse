import type { Lead, LeadMove } from "@/entities/lead/index.js";

const columnOf = (leads: readonly Lead[], stage: string, except?: string) =>
  leads.filter((lead) => lead.stage === stage && lead.id !== except).sort((a, b) => a.position - b.position);

export interface PlacementContext {
  all: readonly Lead[];
  shown: readonly Lead[];
  sorted: boolean;
}

function fullPosition(activeId: string, shownMove: LeadMove, all: readonly Lead[], shown: readonly Lead[]): number {
  const target = columnOf(all, shownMove.stage, activeId);
  const shownTarget = columnOf(shown, shownMove.stage, activeId);
  if (shownTarget.length === target.length) return shownMove.position;
  const anchor = shownTarget[shownMove.position];
  if (anchor) return target.findIndex((lead) => lead.id === anchor.id);
  const last = shownTarget[shownTarget.length - 1];
  return last ? target.findIndex((lead) => lead.id === last.id) + 1 : target.length;
}

export function boardPlacement(activeId: string, shownMove: LeadMove, { all, shown, sorted }: PlacementContext): LeadMove | null {
  const original = all.find((lead) => lead.id === activeId);
  if (!original) return null;
  const sameColumn = shownMove.stage === original.stage;
  if (sorted) {
    return sameColumn ? null : { stage: shownMove.stage, position: columnOf(all, shownMove.stage, activeId).length };
  }
  const position = fullPosition(activeId, shownMove, all, shown);
  if (sameColumn && columnOf(all, original.stage).findIndex((lead) => lead.id === activeId) === position) return null;
  return { stage: shownMove.stage, position };
}
