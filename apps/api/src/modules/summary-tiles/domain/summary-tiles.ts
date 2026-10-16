export const SUMMARY_TILES = ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSIONS", "RESULTS", "CPC", "KPI"] as const;
export type SummaryTile = (typeof SUMMARY_TILES)[number];

export const MAX_SUMMARY_TILES = 5;

export type SummaryOwner =
  | { readonly kind: "dashboard" }
  | { readonly kind: "project"; readonly id: string };

export function inCatalogueOrder(tiles: readonly SummaryTile[]): SummaryTile[] {
  return SUMMARY_TILES.filter((tile) => tiles.includes(tile));
}
