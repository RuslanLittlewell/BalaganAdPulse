export const SUMMARY_TILES = ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSIONS", "RESULTS", "CPC", "KPI"] as const;
export type SummaryTile = (typeof SUMMARY_TILES)[number];

export const MAX_SUMMARY_TILES = 5;
