import {
  WEEKDAY_INITIALS,
  dayLabel,
  monthDays,
  monthLabel,
  monthOf,
  stepMonth,
} from "./month.js";

describe("monthDays", () => {
  it("returns six full weeks, starting on the Monday on or before the first", () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    const days = monthDays({ year: 2026, month: 7 });

    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-07-27");
    expect(days[5]).toBe("2026-08-01");
    expect(days.at(-1)).toBe("2026-09-06");
  });

  it("opens on the first itself when the month starts on a Monday", () => {
    // 1 June 2026 is a Monday.
    expect(monthDays({ year: 2026, month: 5 })[0]).toBe("2026-06-01");
  });
});

describe("monthLabel", () => {
  it("names the month and the year", () => {
    expect(monthLabel({ year: 2026, month: 7 })).toBe("August 2026");
  });
});

describe("dayLabel", () => {
  it("names a day unambiguously across a grid", () => {
    expect(dayLabel("2026-08-03")).toBe("03 August 2026");
  });
});

describe("monthOf", () => {
  it("reads the month a day belongs to", () => {
    expect(monthOf("2026-08-03")).toEqual({ year: 2026, month: 7 });
  });
});

describe("stepMonth", () => {
  it("steps within a year", () => {
    expect(stepMonth({ year: 2026, month: 7 }, 1)).toEqual({ year: 2026, month: 8 });
  });

  it("crosses the year boundary in both directions", () => {
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(stepMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("WEEKDAY_INITIALS", () => {
  it("lists seven columns starting on Monday", () => {
    expect(WEEKDAY_INITIALS).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });
});
