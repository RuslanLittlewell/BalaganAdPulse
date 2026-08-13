import { act, renderHook } from "@testing-library/react";
import { nextCell, useSheetEditing } from "./useSheetEditing.js";

const records = ["r1", "r2", "r3"];
// The computed columns are absent by construction, so stepping skips them.
const properties = ["p1", "p2"];

describe("nextCell", () => {
  it("steps to the next column in the same row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p1" }, 1, records, properties))
      .toEqual({ recordId: "r1", propertyId: "p2" });
  });

  it("crosses into the next row at the end of a row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p2" }, 1, records, properties))
      .toEqual({ recordId: "r2", propertyId: "p1" });
  });

  it("crosses into the previous row at the start of a row", () => {
    expect(nextCell({ recordId: "r2", propertyId: "p1" }, -1, records, properties))
      .toEqual({ recordId: "r1", propertyId: "p2" });
  });

  it("stops at the last cell of the last row instead of wrapping around", () => {
    expect(nextCell({ recordId: "r3", propertyId: "p2" }, 1, records, properties)).toBeNull();
  });

  it("stops at the first cell of the first row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p1" }, -1, records, properties)).toBeNull();
  });

  it("returns null for a cell that is no longer in the grid", () => {
    expect(nextCell({ recordId: "gone", propertyId: "p1" }, 1, records, properties)).toBeNull();
  });
});

describe("useSheetEditing", () => {
  it("opens one cell at a time", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    expect(result.current.isEditing("r1", "p1")).toBe(false);
    act(() => result.current.open("r1", "p1"));
    expect(result.current.isEditing("r1", "p1")).toBe(true);
    expect(result.current.isEditing("r1", "p2")).toBe(false);
  });

  it("closes without a direction", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r1", "p1"));
    act(() => result.current.close({ recordId: "r1", propertyId: "p1" }));
    expect(result.current.isEditing("r1", "p1")).toBe(false);
  });

  it("moves the open cell when closed with a direction", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r1", "p2"));
    act(() => result.current.close({ recordId: "r1", propertyId: "p2" }, 1));
    expect(result.current.isEditing("r2", "p1")).toBe(true);
  });

  it("leaves the grid at the last cell", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r3", "p2"));
    act(() => result.current.close({ recordId: "r3", propertyId: "p2" }, 1));
    expect(result.current.isEditing("r3", "p2")).toBe(false);
  });
});
