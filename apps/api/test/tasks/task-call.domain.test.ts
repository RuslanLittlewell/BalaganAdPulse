import { describe, expect, it } from "vitest";
import { UNSCHEDULED, rescheduled, type TaskSchedule } from "../../src/modules/tasks/domain/schedule.js";

const weeklyCall: TaskSchedule = {
  dueDate: "2026-10-19", dueTime: "10:00", endTime: "10:30", repeatEvery: "WEEKLY", isCall: true,
  skipWeekends: false, timeZone: null,
};

describe("a call's schedule", () => {
  it("is not a call unless asked", () => {
    expect(rescheduled(UNSCHEDULED, { dueDate: "2026-10-19", dueTime: "10:00", repeatEvery: "WEEKLY" }).isCall)
      .toBe(false);
  });

  it("keeps the mark it is given", () => {
    expect(rescheduled(UNSCHEDULED, {
      dueDate: "2026-10-19", dueTime: "10:00", repeatEvery: "DAILY", isCall: true,
    }).isCall).toBe(true);
  });

  it("stays a call when it moves to another day and time", () => {
    expect(rescheduled(weeklyCall, { dueDate: "2026-10-21", dueTime: "15:00" }).isCall).toBe(true);
  });

  it("stays a call when it stops repeating", () => {
    expect(rescheduled(weeklyCall, { repeatEvery: "NONE" })).toMatchObject({ repeatEvery: "NONE", isCall: true });
  });

  it("may be a call without a repetition", () => {
    expect(rescheduled(UNSCHEDULED, { dueDate: "2026-10-19", dueTime: "10:00", isCall: true }).isCall).toBe(true);
  });

  it("stops being a call when it loses its time", () => {
    expect(rescheduled(weeklyCall, { dueTime: null })).toMatchObject({ dueTime: null, isCall: false });
  });

  it("passes on an explicit mark as given, for the rule to judge", () => {
    expect(rescheduled(weeklyCall, { repeatEvery: "NONE", isCall: true }).isCall).toBe(true);
  });
});
