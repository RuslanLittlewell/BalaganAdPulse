import { act, renderHook } from "@testing-library/react";
import { ariaSortOf, nextSort, sortRows, useTableSort } from "@/shared/lib/index.js";

const spend = (row: { spend: number | null }) => row.spend;
const name = (row: { name: string }) => row.name;

describe("sortRows", () => {
  it("orders numbers by value, not as text", () => {
    const rows = [{ spend: 10 }, { spend: 9 }, { spend: 100 }];
    expect(sortRows(rows, spend, "asc").map(spend)).toEqual([9, 10, 100]);
    expect(sortRows(rows, spend, "desc").map(spend)).toEqual([100, 10, 9]);
  });

  it("orders text by the Russian alphabet regardless of case", () => {
    const rows = [{ name: "Ёлка" }, { name: "арка" }, { name: "Бар" }, { name: "Яма" }, { name: "Вокзал" }];
    expect(sortRows(rows, name, "asc").map(name)).toEqual(["арка", "Бар", "Вокзал", "Ёлка", "Яма"]);
  });

  it("keeps rows without a value last in both directions", () => {
    const rows = [{ spend: null }, { spend: 5 }, { spend: Number.NaN }, { spend: 1 }];
    expect(sortRows(rows, spend, "asc").map(spend).slice(0, 2)).toEqual([1, 5]);
    expect(sortRows(rows, spend, "desc").map(spend).slice(0, 2)).toEqual([5, 1]);
    expect(sortRows(rows, spend, "desc").slice(2).every((row) => row.spend === null || Number.isNaN(row.spend))).toBe(true);
  });

  it("keeps equal rows in their original order and leaves the input untouched", () => {
    const rows = [{ id: "a", spend: 1 }, { id: "b", spend: 1 }, { id: "c", spend: 0 }];
    expect(sortRows(rows, spend, "desc").map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("nextSort", () => {
  it("goes descending, ascending, then off, and starts over on another column", () => {
    const first = nextSort(null, "spend");
    expect(first).toEqual({ key: "spend", direction: "desc" });
    const second = nextSort(first, "spend");
    expect(second).toEqual({ key: "spend", direction: "asc" });
    expect(nextSort(second, "spend")).toBeNull();
    expect(nextSort(second, "leads")).toEqual({ key: "leads", direction: "desc" });
  });
});

describe("ariaSortOf", () => {
  it("names each direction", () => {
    expect([ariaSortOf("asc"), ariaSortOf("desc"), ariaSortOf(null)]).toEqual(["ascending", "descending", "none"]);
  });
});

describe("useTableSort", () => {
  const rows = [{ id: "a", spend: 3 }, { id: "b", spend: 1 }, { id: "c", spend: 2 }];
  const ids = (list: readonly (typeof rows)[number][]) => list.map((row) => row.id).join("");

  it("returns the rows as given until a column is chosen, then cycles through the directions", () => {
    const { result } = renderHook(() => useTableSort(rows, { spend: (row) => row.spend }));
    expect(ids(result.current.rows)).toBe("abc");
    expect(result.current.directionOf("spend")).toBeNull();

    act(() => result.current.toggle("spend"));
    expect(ids(result.current.rows)).toBe("acb");
    expect(result.current.directionOf("spend")).toBe("desc");

    act(() => result.current.toggle("spend"));
    expect(ids(result.current.rows)).toBe("bca");
    expect(result.current.directionOf("spend")).toBe("asc");

    act(() => result.current.toggle("spend"));
    expect(ids(result.current.rows)).toBe("abc");
    expect(result.current.directionOf("spend")).toBeNull();
  });
});
