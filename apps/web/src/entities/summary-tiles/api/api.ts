import { http } from "@/shared/lib/index.js";
import type { Channel } from "@/entities/campaign/index.js";
import type { SummaryTile } from "../model/catalogue.js";

export type SummaryOwner =
  | { kind: "dashboard" }
  | { kind: "project"; id: string };

export interface SummaryAccount {
  channel: Channel;
  accountId: string;
}

export interface AccountTiles {
  account: SummaryAccount;
  tiles: SummaryTile[];
}

export interface ChosenTiles {
  tiles: SummaryTile[];
  accounts?: AccountTiles[];
}

const pathOf = (owner: SummaryOwner) => owner.kind === "dashboard"
  ? "/dashboard/summary-tiles"
  : `/projects/${encodeURIComponent(owner.id)}/summary-tiles`;

export const summaryTilesApi = {
  read: (owner: SummaryOwner) => http.get<ChosenTiles>(pathOf(owner)),
  save: (owner: SummaryOwner, tiles: readonly SummaryTile[], account: SummaryAccount | null = null) =>
    http.put<ChosenTiles>(pathOf(owner), account ? { tiles, account } : { tiles }),
};
