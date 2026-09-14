import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SUMMARY_TILES = ["spend", "impressions", "clicks", "conversions", "cpc", "kpi"] as const;
export type SummaryTile = (typeof SUMMARY_TILES)[number];
export type SummaryScreen = "dashboard" | "project" | "campaign";

export const MAX_SUMMARY_TILES = 5;
export const DEFAULT_SUMMARY_TILES: readonly SummaryTile[] = ["conversions"];

type Layouts = Record<string, Partial<Record<SummaryScreen, SummaryTile[]>>>;

interface SummaryTilesState {
  layouts: Layouts;
  toggleTile: (userId: string, screen: SummaryScreen, tile: SummaryTile, offered: readonly SummaryTile[]) => void;
}

export function chosenTiles(layouts: Layouts, userId: string | undefined, screen: SummaryScreen, offered: readonly SummaryTile[]): SummaryTile[] {
  const stored = userId ? layouts[userId]?.[screen] : undefined;
  const chosen = stored ?? DEFAULT_SUMMARY_TILES;
  return SUMMARY_TILES.filter((tile) => offered.includes(tile) && chosen.includes(tile));
}

export const useSummaryTiles = create<SummaryTilesState>()(
  persist(
    (set) => ({
      layouts: {},
      toggleTile: (userId, screen, tile, offered) => set((state) => {
        if (!offered.includes(tile)) return state;
        const current = chosenTiles(state.layouts, userId, screen, offered);
        const next = current.includes(tile)
          ? current.filter((candidate) => candidate !== tile)
          : current.length < MAX_SUMMARY_TILES ? [...current, tile] : current;
        const ordered = SUMMARY_TILES.filter((candidate) => next.includes(candidate));
        return { layouts: { ...state.layouts, [userId]: { ...state.layouts[userId], [screen]: ordered } } };
      }),
    }),
    { name: "adpulse-summary-tiles", version: 1, partialize: (state) => ({ layouts: state.layouts }) },
  ),
);
