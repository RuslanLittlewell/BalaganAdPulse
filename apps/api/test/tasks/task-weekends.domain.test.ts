import { describe, expect, it } from "vitest";
import {
  UNSCHEDULED,
  firstWeekday,
  isWeekend,
  nextDueDate,
  rescheduled,
  type TaskSchedule,
} from "../../src/modules/tasks/domain/schedule.js";

const dailyOnWeekdays: TaskSchedule = {
  dueDate: "2026-10-23", dueTime: "10:00", endTime: null, repeatEvery: "DAILY", isCall: false,
  skipWeekends: true, timeZone: "Europe/Minsk",
};

describe("skipping weekends", () => {
  it("knows Saturday and Sunday from the weekdays", () => {
    expect(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map(isWeekend)).toEqual([false, true, true, false]);
  });

  it("steps a daily task over the weekend", () => {
    expect(nextDueDate("2026-10-23", "DAILY", true)).toBe("2026-10-26");
    expect(nextDueDate("2026-10-23", "DAILY", false)).toBe("2026-10-24");
  });

  it("leaves out a monthly occurrence that falls on a weekend", () => {
    expect(nextDueDate("2026-10-15", "MONTHLY", true)).toBe("2026-12-15");
  });

  it("moves a weekly or fortnightly day on a weekend to the following Monday", () => {
    expect(firstWeekday("2026-10-25", "WEEKLY")).toBe("2026-10-26");
    expect(firstWeekday("2026-10-24", "BIWEEKLY")).toBe("2026-10-26");
  });

  it("keeps a weekday as it is", () => {
    expect(firstWeekday("2026-10-21", "MONTHLY")).toBe("2026-10-21");
  });

  it("moves a due date on a weekend to its first weekday when saved", () => {
    expect(rescheduled(UNSCHEDULED, {
      dueDate: "2026-10-24", dueTime: "10:00", repeatEvery: "DAILY", skipWeekends: true,
    })).toMatchObject({ dueDate: "2026-10-26", dueTime: "10:00", skipWeekends: true });
  });

  it("moves the due date when a task on a weekend starts skipping weekends", () => {
    expect(rescheduled({ ...dailyOnWeekdays, dueDate: "2026-10-25", skipWeekends: false }, { skipWeekends: true }).dueDate)
      .toBe("2026-10-26");
  });

  it("stops skipping when the task stops repeating", () => {
    expect(rescheduled(dailyOnWeekdays, { repeatEvery: "NONE" })).toMatchObject({ repeatEvery: "NONE", skipWeekends: false });
  });

  it("passes on an explicit request to skip without a repetition, for the rule to judge", () => {
    expect(rescheduled(UNSCHEDULED, { dueDate: "2026-10-24", skipWeekends: true })).toMatchObject({
      dueDate: "2026-10-24", repeatEvery: "NONE", skipWeekends: true,
    });
  });
});

describe("a schedule's time zone", () => {
  it("is none until a request names one", () => {
    expect(rescheduled(UNSCHEDULED, { dueDate: "2026-10-24", dueTime: "10:00" }).timeZone).toBeNull();
  });

  it("is the zone named last", () => {
    expect(rescheduled(dailyOnWeekdays, { dueTime: "09:00", timeZone: "Europe/Warsaw" }).timeZone).toBe("Europe/Warsaw");
  });

  it("stays when a change names none", () => {
    expect(rescheduled(dailyOnWeekdays, { repeatEvery: "WEEKLY" }).timeZone).toBe("Europe/Minsk");
  });
});
