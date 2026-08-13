import { useState } from "react";

export interface CellPosition {
  recordId: string;
  propertyId: string;
}

/**
 * The cell one step away in reading order. `propertyIds` lists the editable columns
 * only, so computed ones are stepped over. Returns null at either end of the grid:
 * editing leaves rather than wrapping around.
 */
export function nextCell(
  from: CellPosition,
  direction: 1 | -1,
  recordIds: string[],
  propertyIds: string[],
): CellPosition | null {
  const row = recordIds.indexOf(from.recordId);
  const column = propertyIds.indexOf(from.propertyId);
  if (row < 0 || column < 0 || propertyIds.length === 0) return null;

  const target = row * propertyIds.length + column + direction;
  if (target < 0 || target >= recordIds.length * propertyIds.length) return null;

  return {
    recordId: recordIds[Math.floor(target / propertyIds.length)],
    propertyId: propertyIds[target % propertyIds.length],
  };
}

/** Holds the one open cell of a grid and the transitions between cells. */
export function useSheetEditing(recordIds: string[], propertyIds: string[]) {
  const [cell, setCell] = useState<CellPosition | null>(null);

  return {
    isEditing: (recordId: string, propertyId: string) =>
      cell?.recordId === recordId && cell.propertyId === propertyId,
    open: (recordId: string, propertyId: string) => setCell({ recordId, propertyId }),
    close: (from: CellPosition, direction?: 1 | -1) =>
      setCell(direction == null ? null : nextCell(from, direction, recordIds, propertyIds)),
  };
}
