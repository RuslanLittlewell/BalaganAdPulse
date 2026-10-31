import type { KpiAccount } from "#modules/campaigns/index.js";

export const SUMMARY_TILES = ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSIONS", "RESULTS", "CPC", "KPI"] as const;
export type SummaryTile = (typeof SUMMARY_TILES)[number];

export const MAX_SUMMARY_TILES = 5;

export type SummaryOwner =
  | { readonly kind: "dashboard" }
  | { readonly kind: "project"; readonly id: string };

export type SummaryAccount = KpiAccount;

export interface AccountTiles {
  readonly account: SummaryAccount;
  readonly tiles: SummaryTile[];
}

export interface ChosenTiles {
  readonly tiles: SummaryTile[];
  readonly accounts?: AccountTiles[];
}

export const sameAccount = (left: SummaryAccount, right: SummaryAccount) =>
  left.channel === right.channel && left.accountId === right.accountId;
