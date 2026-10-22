import { useState } from "react";

export type SortValue = string | number | null | undefined;
export type SortDirection = "asc" | "desc";
export type AriaSort = "ascending" | "descending" | "none";

export interface TableSort<Key extends string = string> {
  key: Key;
  direction: SortDirection;
}

const isEmpty = (value: SortValue): value is null | undefined =>
  value == null || (typeof value === "number" && Number.isNaN(value));

function compareValues(a: NonNullable<SortValue>, b: NonNullable<SortValue>): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ru", { sensitivity: "base", numeric: true });
}

export function sortRows<Row>(
  rows: readonly Row[],
  value: (row: Row) => SortValue,
  direction: SortDirection,
): Row[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (isEmpty(a)) return isEmpty(b) ? 0 : 1;
    if (isEmpty(b)) return -1;
    return sign * compareValues(a, b);
  });
}

export function nextSort<Key extends string>(current: TableSort<Key> | null, key: Key): TableSort<Key> | null {
  if (current?.key !== key) return { key, direction: "desc" };
  return current.direction === "desc" ? { key, direction: "asc" } : null;
}

export function ariaSortOf(direction: SortDirection | null): AriaSort {
  if (direction === null) return "none";
  return direction === "asc" ? "ascending" : "descending";
}

export function useSortState<Key extends string>() {
  const [sort, setSort] = useState<TableSort<Key> | null>(null);
  return {
    sort,
    toggle: (key: Key) => setSort((current) => nextSort(current, key)),
    directionOf: (key: Key): SortDirection | null => (sort?.key === key ? sort.direction : null),
  };
}

export function useTableSort<Row, Key extends string>(
  rows: readonly Row[],
  accessors: Record<Key, (row: Row) => SortValue>,
) {
  const state = useSortState<Key>();
  const sorted = state.sort === null ? rows : sortRows(rows, accessors[state.sort.key], state.sort.direction);
  return { rows: sorted, toggle: state.toggle, directionOf: state.directionOf };
}
