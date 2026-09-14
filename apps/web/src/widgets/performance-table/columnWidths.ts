import { create } from "zustand";
import { persist } from "zustand/middleware";
import { METRIC_COLUMNS } from "@/entities/campaign/index.js";

export const MIN_NAME_WIDTH = 80;
export const DEFAULT_NAME_WIDTH = 280;
export const ALL_COLUMN_IDS = ["name", ...METRIC_COLUMNS.map((column) => column.id)];
export const MIN_VISIBLE_COLUMNS = 2;

export function isRequiredColumn(tableKey: string, columnId: string): boolean {
  return tableKey === "ad-sets" && columnId === "name";
}

export function visibleColumnIds(saved: unknown, tableKey = "performance"): string[] {
  if (!Array.isArray(saved)) return ALL_COLUMN_IDS;
  const valid = ALL_COLUMN_IDS.filter((id) => saved.includes(id) || isRequiredColumn(tableKey, id));
  return valid.length >= MIN_VISIBLE_COLUMNS ? valid : ALL_COLUMN_IDS;
}

interface ColumnWidthsState {
  nameWidths: Record<string, number>;
  visibleColumns: Record<string, string[]>;
  toggleColumn: (tableKey: string, columnId: string) => void;
  setNameWidth: (tableKey: string, width: number) => void;
}

export const useColumnWidths = create<ColumnWidthsState>()(
  persist(
    (set) => ({
      nameWidths: {},
      visibleColumns: {},
      toggleColumn: (tableKey, columnId) => {
        if (!ALL_COLUMN_IDS.includes(columnId) || isRequiredColumn(tableKey, columnId)) return;
        set((state) => {
          const current = visibleColumnIds(state.visibleColumns?.[tableKey], tableKey);
          if (current.includes(columnId) && current.length <= MIN_VISIBLE_COLUMNS) return state;
          const next = current.includes(columnId)
            ? current.filter((id) => id !== columnId)
            : [...current, columnId];
          return { visibleColumns: { ...state.visibleColumns, [tableKey]: next } };
        });
      },
      setNameWidth: (tableKey, width) => {
        if (!Number.isFinite(width)) return;
        set((state) => ({
          nameWidths: { ...state.nameWidths, [tableKey]: Math.max(MIN_NAME_WIDTH, width) },
        }));
      },
    }),
    {
      name: "adpulse-performance-column-widths",
      version: 1,
      partialize: (state) => ({ nameWidths: state.nameWidths, visibleColumns: state.visibleColumns }),
    },
  ),
);
