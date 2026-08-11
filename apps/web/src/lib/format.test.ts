import { formatValue, formatDay, nextDay, todayIso } from "./format.js";

describe("formatValue", () => {
  it("renders money with two decimals and grouped thousands", () => {
    expect(formatValue("120.0000", "MONEY")).toBe("120.00");
    expect(formatValue("1234567.8900", "MONEY")).toBe("1,234,567.89");
  });

  it("renders zero, not a dash, since it checks for null/empty rather than truthiness", () => {
    expect(formatValue("0.0000", "MONEY")).toBe("0.00");
  });

  it("renders numbers without trailing zeros", () => {
    expect(formatValue("4500.0000", "NUMBER")).toBe("4,500");
    expect(formatValue("1234.5000", "NUMBER")).toBe("1,234.5");
  });

  it("renders percents with a suffix", () => {
    expect(formatValue("2.0000", "PERCENT")).toBe("2.00%");
  });

  it("passes text through untouched", () => {
    expect(formatValue("good day", "TEXT")).toBe("good day");
  });

  it("renders a dash for missing values", () => {
    expect(formatValue(null, "MONEY")).toBe("—");
    expect(formatValue(null, "TEXT")).toBe("—");
    expect(formatValue("", "NUMBER")).toBe("—");
  });
});

describe("formatDay", () => {
  it("renders an ISO date as day and short month", () => {
    expect(formatDay("2026-08-01")).toBe("01 Aug");
    expect(formatDay("2026-12-31")).toBe("31 Dec");
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
    // TZ is pinned to Asia/Tokyo (UTC+9) in vite.config.ts. This instant is
    // 2026-08-01 in UTC but already 2026-08-02 05:00 local — a UTC-based
    // implementation would answer with the wrong day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T20:00:00Z"));

    try {
      expect(todayIso()).toBe("2026-08-02");
    } finally {
      vi.useRealTimers();
    }
  });
});
