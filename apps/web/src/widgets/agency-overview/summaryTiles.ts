import { MAX_SUMMARY_TILES, SUMMARY_TILES, type SummaryTile } from "@/entities/summary-tiles/index.js";

export { MAX_SUMMARY_TILES, SUMMARY_TILES, type SummaryTile };

export function chosenTiles(stored: readonly SummaryTile[], offered: readonly SummaryTile[]): SummaryTile[] {
  return stored.filter((tile) => offered.includes(tile));
}

export function toggledTiles(stored: readonly SummaryTile[], tile: SummaryTile, offered: readonly SummaryTile[]): SummaryTile[] {
  const current = chosenTiles(stored, offered);
  if (!offered.includes(tile)) return current;
  if (current.includes(tile)) return current.filter((candidate) => candidate !== tile);
  if (current.length >= MAX_SUMMARY_TILES) return current;
  return [...current, tile];
}

export function movedTo(order: readonly SummaryTile[], tile: SummaryTile, place: number): SummaryTile[] {
  const rest = order.filter((candidate) => candidate !== tile);
  if (rest.length === order.length || place < 0 || place > rest.length) return [...order];
  return [...rest.slice(0, place), tile, ...rest.slice(place)];
}

export const sameOrder = (left: readonly SummaryTile[], right: readonly SummaryTile[]) =>
  left.length === right.length && left.every((tile, index) => tile === right[index]);

export interface TileDrag {
  tile: SummaryTile;
  order: SummaryTile[];
  over: SummaryTile;
}

export const dragStarted = (order: readonly SummaryTile[], tile: SummaryTile): TileDrag =>
  ({ tile, order: [...order], over: tile });

export function draggedOver(drag: TileDrag, over: SummaryTile | null): TileDrag {
  if (over === null || over === drag.over) return drag;
  if (over === drag.tile) return { ...drag, over };
  return { ...drag, over, order: movedTo(drag.order, drag.tile, drag.order.indexOf(over)) };
}
