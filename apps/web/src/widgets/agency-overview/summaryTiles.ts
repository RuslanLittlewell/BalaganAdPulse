import { MAX_SUMMARY_TILES, SUMMARY_TILES, type SummaryTile } from "@/entities/summary-tiles/index.js";

export { MAX_SUMMARY_TILES, SUMMARY_TILES, type SummaryTile };

export function chosenTiles(stored: readonly SummaryTile[], offered: readonly SummaryTile[]): SummaryTile[] {
  return SUMMARY_TILES.filter((tile) => offered.includes(tile) && stored.includes(tile));
}

export function toggledTiles(stored: readonly SummaryTile[], tile: SummaryTile, offered: readonly SummaryTile[]): SummaryTile[] {
  const current = chosenTiles(stored, offered);
  if (!offered.includes(tile)) return current;
  if (current.includes(tile)) return current.filter((candidate) => candidate !== tile);
  if (current.length >= MAX_SUMMARY_TILES) return current;
  return chosenTiles([...current, tile], offered);
}
