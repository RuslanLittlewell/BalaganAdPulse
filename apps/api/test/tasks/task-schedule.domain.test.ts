import { describe, expect, it } from "vitest";
import { nextOccurrence } from "../../src/modules/tasks/domain/schedule.js";

describe("the next occurrence of a repeating task", () => {
  it("is the next day for a daily task", () => {
    expect(nextOccurrence("2026-09-17", "DAILY")).toBe("2026-09-18");
  });

  it("is the same weekday a week on for a weekly task", () => {
    expect(nextOccurrence("2026-09-16", "WEEKLY")).toBe("2026-09-23");
  });

  it("is a fortnight on for a task that repeats every two weeks", () => {
    expect(nextOccurrence("2026-09-17", "BIWEEKLY")).toBe("2026-10-01");
  });

  it("is the same day of the next month for a monthly task", () => {
    expect(nextOccurrence("2026-09-25", "MONTHLY")).toBe("2026-10-25");
  });

  it("falls on the last day of a month too short to hold it", () => {
    expect(nextOccurrence("2026-01-31", "MONTHLY")).toBe("2026-02-28");
  });

  it("finds the twenty-ninth in a leap year", () => {
    expect(nextOccurrence("2028-01-31", "MONTHLY")).toBe("2028-02-29");
  });

  it("crosses the end of a month", () => {
    expect(nextOccurrence("2026-09-30", "WEEKLY")).toBe("2026-10-07");
  });

  it("crosses the end of a year", () => {
    expect(nextOccurrence("2026-12-31", "DAILY")).toBe("2027-01-01");
    expect(nextOccurrence("2026-12-31", "MONTHLY")).toBe("2027-01-31");
  });

  it("counts from the day it is given, not from today", () => {
    expect(nextOccurrence("2020-03-04", "WEEKLY")).toBe("2020-03-11");
  });
});
