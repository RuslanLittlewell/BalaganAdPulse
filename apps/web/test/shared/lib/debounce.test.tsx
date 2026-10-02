import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "@/shared/lib/debounce.js";

describe("useDebouncedValue", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("settles on the latest value only once it has stopped changing for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    rerender({ value: "л" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "ле" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("");

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("ле");
  });
});
