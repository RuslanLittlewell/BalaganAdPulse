import { inZone, isWeekend, nextDueDate, occurrencesBetween, occurrencesIn } from "@/entities/task/index.js";

const timed = (dueDate: string, dueTime: string, endTime: string | null, timeZone?: string) =>
  ({ dueDate, dueTime, endTime, timeZone });

describe("a task's day and time in the reader's time zone", () => {
  it("reads 10:00 in Minsk as 09:00 in Warsaw in summer", () => {
    expect(inZone(timed("2026-09-25", "10:00", "11:00", "Europe/Minsk"), "Europe/Warsaw"))
      .toMatchObject({ dueDate: "2026-09-25", dueTime: "09:00", endTime: "10:00", timeZone: "Europe/Minsk" });
  });

  it("moves to the reader's day when midnight lies between", () => {
    expect(inZone(timed("2026-09-26", "00:30", null, "Europe/Minsk"), "Europe/Warsaw"))
      .toMatchObject({ dueDate: "2026-09-25", dueTime: "23:30", endTime: null });
  });

  it("ends at 24:00 when the task would end on the reader's next day", () => {
    expect(inZone(timed("2026-09-25", "16:00", "19:00", "Europe/Minsk"), "Asia/Tokyo"))
      .toMatchObject({ dueDate: "2026-09-25", dueTime: "22:00", endTime: "24:00" });
  });

  it("leaves alone a task with no time, no zone, or the reader's own zone", () => {
    const dayOnly = { dueDate: "2026-09-25", dueTime: null, endTime: null, timeZone: "Europe/Minsk" };
    const unzoned = timed("2026-09-25", "10:00", null);
    const own = timed("2026-09-25", "10:00", null, "Europe/Warsaw");

    expect(inZone(dayOnly, "Europe/Warsaw")).toBe(dayOnly);
    expect(inZone(unzoned, "Europe/Warsaw")).toBe(unzoned);
    expect(inZone(own, "Europe/Warsaw")).toBe(own);
  });
});

describe("the occurrences of a call in the reader's time zone", () => {
  const daily = (overrides = {}) => ({
    dueDate: "2026-10-19", dueTime: "11:00", endTime: "11:15", repeatEvery: "DAILY" as const,
    skipWeekends: false, timeZone: "Europe/Warsaw", ...overrides,
  });

  it("keeps each occurrence at the call's own hour across a change of clocks", () => {
    const shown = occurrencesIn(daily(), "2026-10-19", "2026-10-25", "Europe/Minsk");

    expect(shown.map(({ day, dueTime }) => `${day} ${dueTime}`)).toEqual([
      "2026-10-19 11:00", "2026-10-20 11:00", "2026-10-21 11:00", "2026-10-22 11:00",
      "2026-10-23 11:00", "2026-10-24 11:00", "2026-10-25 12:00",
    ]);
    expect(shown[6]).toMatchObject({ endTime: "12:15" });
  });

  it("leaves out the weekends in the call's own zone", () => {
    expect(occurrencesIn(daily({ skipWeekends: true }), "2026-10-19", "2026-10-25", "Europe/Minsk").map(({ day }) => day))
      .toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  });

  it("counts weekdays in the call's zone when they fall on the reader's previous day", () => {
    const afterMidnightInMinsk = daily({ dueTime: "23:30", endTime: null, skipWeekends: true, timeZone: "Europe/Minsk" });

    expect(occurrencesIn(afterMidnightInMinsk, "2026-10-18", "2026-10-25", "Europe/Warsaw").map(({ day, dueTime }) => `${day} ${dueTime}`))
      .toEqual(["2026-10-19 23:30", "2026-10-20 23:30", "2026-10-21 23:30", "2026-10-22 23:30", "2026-10-25 22:30"]);
  });

  it("is the due day alone for a call that does not repeat", () => {
    expect(occurrencesIn(daily({ repeatEvery: "NONE" }), "2026-10-19", "2026-10-25", "Europe/Minsk"))
      .toEqual([{ day: "2026-10-19", dueTime: "11:00", endTime: "11:15" }]);
  });
});

describe("weekends", () => {
  it("are Saturday and Sunday", () => {
    expect(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map(isWeekend)).toEqual([false, true, true, false]);
  });

  it("are left out of a repetition that skips them", () => {
    expect(occurrencesBetween({ dueDate: "2026-10-19", repeatEvery: "DAILY", skipWeekends: true }, "2026-10-19", "2026-10-25"))
      .toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  });

  it("are stepped over when the task is completed", () => {
    expect(nextDueDate("2026-10-23", "DAILY", true)).toBe("2026-10-26");
    expect(nextDueDate("2026-10-15", "MONTHLY", true)).toBe("2026-12-15");
    expect(nextDueDate("2026-10-23", "DAILY", false)).toBe("2026-10-24");
  });
});
