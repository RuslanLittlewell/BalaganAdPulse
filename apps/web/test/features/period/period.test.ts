import { PERIODS, periodLabel, rangeOf } from "@/features/period/index.js";

// "Today" is a parameter rather than the clock, so a period means the same
// thing in a test in August as in a test run any other day.
const TODAY = "2026-08-17";

describe("rangeOf", () => {
  it("counts the last seven days including today", () => {
    expect(rangeOf("7d", TODAY)).toEqual({ from: "2026-08-11", to: "2026-08-17" });
  });

  it("counts the last thirty days including today", () => {
    expect(rangeOf("30d", TODAY)).toEqual({ from: "2026-07-19", to: "2026-08-17" });
  });

  it("counts the last ninety days including today", () => {
    expect(rangeOf("90d", TODAY)).toEqual({ from: "2026-05-20", to: "2026-08-17" });
  });

  // The month so far, not the whole month: the days after today have no
  // figures, and a range that includes them makes the period look worse.
  it("runs this month from its first day to today", () => {
    expect(rangeOf("month", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-17" });
  });

  it("runs last month from its first day to its last", () => {
    expect(rangeOf("prevMonth", TODAY)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("steps back across a year boundary", () => {
    expect(rangeOf("prevMonth", "2026-01-09")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("counts February's real length in a leap year", () => {
    expect(rangeOf("prevMonth", "2028-03-05")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("names every period in Russian", () => {
    expect(PERIODS.map(periodLabel)).toEqual([
      "7 дней", "30 дней", "90 дней", "Этот месяц", "Прошлый месяц",
    ]);
  });
});
