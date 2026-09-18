import { shiftWeek, startOfWeek, weekDays, weekLabel } from "@/widgets/task-calendar/week.js";

describe("the week a day falls in", () => {
  it("starts on Monday", () => {
    expect(startOfWeek("2026-09-17")).toBe("2026-09-14");
  });

  it("starts on the day itself when that day is a Monday", () => {
    expect(startOfWeek("2026-09-14")).toBe("2026-09-14");
  });

  it("reaches back over Sunday rather than forward", () => {
    expect(startOfWeek("2026-09-20")).toBe("2026-09-14");
  });

  it("crosses the end of a month", () => {
    expect(startOfWeek("2026-10-01")).toBe("2026-09-28");
  });

  it("crosses the end of a year", () => {
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28");
  });

  it("holds seven days, Monday to Sunday", () => {
    expect(weekDays("2026-09-14")).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17",
      "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
  });
});

describe("moving between weeks", () => {
  it("goes to the next week", () => {
    expect(shiftWeek("2026-09-14", 1)).toBe("2026-09-21");
  });

  it("goes to the previous week", () => {
    expect(shiftWeek("2026-09-14", -1)).toBe("2026-09-07");
  });

  it("travels any distance", () => {
    expect(shiftWeek("2026-09-14", 4)).toBe("2026-10-12");
    expect(shiftWeek("2026-09-14", -37)).toBe("2025-12-29");
  });
});

describe("naming a week", () => {
  it("names a week inside one month", () => {
    expect(weekLabel("2026-09-14")).toBe("14 – 20 сентября 2026");
  });

  it("names a week that crosses a month", () => {
    expect(weekLabel("2026-09-28")).toBe("28 сентября – 4 октября 2026");
  });

  it("names a week that crosses a year", () => {
    expect(weekLabel("2026-12-28")).toBe("28 декабря 2026 – 3 января 2027");
  });
});
