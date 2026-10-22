import { formatDateTime, formatDay, nextDay, shiftDays, todayIso } from "@/shared/lib/format.js";

describe("formatDay", () => {
  it("renders an ISO date as day and short month", () => {
    expect(formatDay("2026-08-01")).toBe("01 авг.");
    expect(formatDay("2026-12-31")).toBe("31 дек.");
  });
});

describe("nextDay", () => {
  it("advances one calendar day", () => {
    expect(nextDay("2026-08-01")).toBe("2026-08-02");
  });

  it("rolls over months and years", () => {
    expect(nextDay("2026-08-31")).toBe("2026-09-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("todayIso", () => {
  it("returns the local calendar day, not the UTC one, when they differ", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T20:00:00Z"));

    try {
      expect(todayIso()).toBe("2026-08-02");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("shiftDays", () => {
  it("moves a day forwards and backwards", () => {
    expect(shiftDays("2026-08-12", 1)).toBe("2026-08-13");
    expect(shiftDays("2026-08-12", -1)).toBe("2026-08-11");
    expect(shiftDays("2026-08-12", 7)).toBe("2026-08-19");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("formatDateTime", () => {
  it("shows the day and the time to the minute, without seconds", () => {
    expect(formatDateTime(new Date(2026, 9, 22, 8, 5, 41).toISOString())).toBe("22.10.2026, 08:05");
  });
});
