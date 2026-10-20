import { describe, expect, it } from "vitest";
import {
  UNSCHEDULED,
  isEndTime,
  rescheduled,
  type TaskSchedule,
} from "../../src/modules/tasks/domain/schedule.js";

const noon: TaskSchedule = {
  dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30", repeatEvery: "NONE", isCall: false,
};

describe("the time a task ends", () => {
  it("accepts every time of day and the end of the day", () => {
    expect(isEndTime("00:15")).toBe(true);
    expect(isEndTime("23:59")).toBe(true);
    expect(isEndTime("24:00")).toBe(true);
  });

  it("accepts nothing past the end of the day", () => {
    expect(isEndTime("24:01")).toBe(false);
    expect(isEndTime("25:00")).toBe(false);
    expect(isEndTime("7:00")).toBe(false);
  });

  it("is taken as given", () => {
    expect(rescheduled(UNSCHEDULED, { dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:00" }))
      .toMatchObject({ dueTime: "12:00", endTime: "13:00" });
  });

  it("travels with the start, keeping the length", () => {
    expect(rescheduled(noon, { dueTime: "15:00" })).toMatchObject({ dueTime: "15:00", endTime: "16:30" });
  });

  it("stays put when the start does", () => {
    expect(rescheduled(noon, { dueDate: "2026-09-26", dueTime: "12:00" }))
      .toMatchObject({ dueDate: "2026-09-26", dueTime: "12:00", endTime: "13:30" });
  });

  it("reaches the end of the day as 24:00", () => {
    expect(rescheduled(noon, { dueTime: "22:30" })).toMatchObject({ endTime: "24:00" });
  });

  it("is carried past the end of the day for the use case to refuse", () => {
    expect(rescheduled(noon, { dueTime: "23:00" })).toMatchObject({ endTime: "24:30" });
  });

  it("follows an explicit end over the kept length", () => {
    expect(rescheduled(noon, { dueTime: "15:00", endTime: "15:15" })).toMatchObject({ endTime: "15:15" });
  });

  it("is cleared with the start", () => {
    expect(rescheduled(noon, { dueTime: null })).toMatchObject({ dueTime: null, endTime: null });
  });

  it("is cleared with the day", () => {
    expect(rescheduled(noon, { dueDate: null })).toMatchObject({ dueDate: null, dueTime: null, endTime: null });
  });

  it("is not invented for a task that had none", () => {
    expect(rescheduled({ ...noon, endTime: null }, { dueTime: "15:00" })).toMatchObject({ endTime: null });
  });
});
