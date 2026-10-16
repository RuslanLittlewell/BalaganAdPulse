import { http } from "@/shared/lib/index.js";
import type { SummaryTile } from "../model/catalogue.js";

export type SummaryOwner =
  | { kind: "dashboard" }
  | { kind: "project"; id: string };

export interface ChosenTiles {
  tiles: SummaryTile[];
}

const pathOf = (owner: SummaryOwner) => owner.kind === "dashboard"
  ? "/dashboard/summary-tiles"
  : `/projects/${encodeURIComponent(owner.id)}/summary-tiles`;

export const summaryTilesApi = {
  read: (owner: SummaryOwner) => http.get<ChosenTiles>(pathOf(owner)),
  save: (owner: SummaryOwner, tiles: readonly SummaryTile[]) =>
    http.put<ChosenTiles>(pathOf(owner), { tiles }),
};
