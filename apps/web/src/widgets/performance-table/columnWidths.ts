import { create } from "zustand";
import { persist } from "zustand/middleware";
import { METRIC_COLUMNS } from "@/entities/campaign/index.js";

export const MIN_NAME_WIDTH = 80;
export const DEFAULT_NAME_WIDTH = 280;
export const MIN_COLUMN_WIDTH = 72;
export const DEFAULT_COLUMN_WIDTH = 128;
export const ALL_COLUMN_IDS = ["name", ...METRIC_COLUMNS.map((column) => column.id)];
export const MIN_VISIBLE_COLUMNS = 2;

export function isRequiredColumn(tableKey: string, columnId: string): boolean {
  return tableKey === "ad-sets" && columnId === "name";
}

export function visibleColumnIds(
  saved: unknown,
  tableKey = "performance",
  extraIds: readonly string[] = [],
): string[] {
  if (!Array.isArray(saved)) return ALL_COLUMN_IDS;
  const valid = [...ALL_COLUMN_IDS, ...extraIds]
    .filter((id) => saved.includes(id) || isRequiredColumn(tableKey, id));
  return valid.length >= MIN_VISIBLE_COLUMNS ? valid : ALL_COLUMN_IDS;
}

export function orderedColumnIds(saved: unknown, ids: readonly string[]): string[] {
  const order = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  return [
    ...order.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !order.includes(id)),
  ];
}

export function columnWidth(saved: unknown): number {
  return typeof saved === "number" && Number.isFinite(saved)
    ? Math.max(MIN_COLUMN_WIDTH, saved)
    : DEFAULT_COLUMN_WIDTH;
}

export type MoveDirection = "left" | "right";

interface ColumnWidthsState {
  nameWidths: Record<string, number>;
  columnWidths: Record<string, Record<string, number>>;
  columnOrder: Record<string, string[]>;
  visibleColumns: Record<string, string[]>;
  toggleColumn: (tableKey: string, columnId: string, extraIds?: readonly string[]) => void;
  setNameWidth: (tableKey: string, width: number) => void;
  setColumnWidth: (tableKey: string, columnId: string, width: number) => void;
  moveColumn: (
    tableKey: string,
    columnId: string,
    direction: MoveDirection,
    visibleIds: readonly string[],
    allIds: readonly string[],
  ) => void;
}

export const useColumnWidths = create<ColumnWidthsState>()(
  persist(
    (set) => ({
      nameWidths: {},
      columnWidths: {},
      columnOrder: {},
      visibleColumns: {},
      toggleColumn: (tableKey, columnId, extraIds = []) => {
        const known = ALL_COLUMN_IDS.includes(columnId) || extraIds.includes(columnId);
        if (!known || isRequiredColumn(tableKey, columnId)) return;
        set((state) => {
          const current = visibleColumnIds(state.visibleColumns?.[tableKey], tableKey, extraIds);
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
      setColumnWidth: (tableKey, columnId, width) => {
        if (!Number.isFinite(width)) return;
        set((state) => ({
          columnWidths: {
            ...state.columnWidths,
            [tableKey]: { ...state.columnWidths?.[tableKey], [columnId]: Math.max(MIN_COLUMN_WIDTH, width) },
          },
        }));
      },
      moveColumn: (tableKey, columnId, direction, visibleIds, allIds) => {
        set((state) => {
          const order = orderedColumnIds(state.columnOrder?.[tableKey], allIds);
          const shown = order.filter((id) => visibleIds.includes(id));
          const at = shown.indexOf(columnId);
          const neighbour = shown[direction === "left" ? at - 1 : at + 1];
          if (at < 0 || neighbour == null) return state;
          const next = order.map((id) => (id === columnId ? neighbour : id === neighbour ? columnId : id));
          return { columnOrder: { ...state.columnOrder, [tableKey]: next } };
        });
      },
    }),
    {
      name: "adpulse-performance-column-widths",
      version: 1,
      partialize: (state) => ({
        nameWidths: state.nameWidths,
        columnWidths: state.columnWidths,
        columnOrder: state.columnOrder,
        visibleColumns: state.visibleColumns,
      }),
    },
  ),
);
