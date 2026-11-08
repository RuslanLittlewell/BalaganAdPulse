import { dueSoon } from "@/entities/task/index.js";
import { aTask } from "@test/shared/index.js";

const NOW = new Date("2026-11-08T10:00:00.000Z");
const ZONE = "UTC";
const ME = "member-1";

const mine = (overrides: Parameters<typeof aTask>[0] = {}) => aTask({ participantIds: [ME], column: "IN_PROGRESS", ...overrides });
const titles = (tasks: ReturnType<typeof dueSoon>) => tasks.map((entry) => entry.task.title);

describe("the tasks due soon", () => {
  it("include a task due today and label it as today", () => {
    const [entry] = dueSoon([mine({ dueDate: "2026-11-08" })], ME, NOW, ZONE);
    expect(entry).toMatchObject({ day: "2026-11-08", when: "today" });
  });

  it("include tomorrow's task and the one two days ahead, and not the one three days ahead", () => {
    const list = dueSoon([
      mine({ title: "tomorrow", dueDate: "2026-11-09" }),
      mine({ title: "in two days", dueDate: "2026-11-10" }),
      mine({ title: "in three days", dueDate: "2026-11-11" }),
    ], ME, NOW, ZONE);
    expect(titles(list)).toEqual(["tomorrow", "in two days"]);
    expect(list.map((entry) => entry.when)).toEqual(["tomorrow", "soon"]);
  });

  it("include an overdue task", () => {
    expect(dueSoon([mine({ dueDate: "2026-11-05" })], ME, NOW, ZONE)[0]?.when).toBe("overdue");
  });

  it("include a task I created that nobody is assigned to", () => {
    expect(dueSoon([aTask({ createdById: ME, participantIds: [], column: "IN_PROGRESS", dueDate: "2026-11-07" })], ME, NOW, ZONE)).toHaveLength(1);
  });

  it("leave out a task I created that is assigned to others", () => {
    expect(dueSoon([aTask({ createdById: ME, participantIds: ["someone"], column: "IN_PROGRESS", dueDate: "2026-11-08" })], ME, NOW, ZONE)).toEqual([]);
  });

  it("leave out a task someone else created that nobody is assigned to", () => {
    expect(dueSoon([aTask({ createdById: "someone", participantIds: [], column: "IN_PROGRESS", dueDate: "2026-11-08" })], ME, NOW, ZONE)).toEqual([]);
  });

  it("leave out other people's tasks", () => {
    expect(dueSoon([aTask({ participantIds: ["someone"], column: "IN_PROGRESS", dueDate: "2026-11-08" })], ME, NOW, ZONE)).toEqual([]);
  });

  it("leave out done and archived tasks", () => {
    expect(dueSoon([mine({ column: "DONE", dueDate: "2026-11-08" }), mine({ column: "ARCHIVED", dueDate: "2026-11-08" })], ME, NOW, ZONE)).toEqual([]);
  });

  it("leave out a task without a due date", () => {
    expect(dueSoon([mine({ dueDate: null })], ME, NOW, ZONE)).toEqual([]);
  });

  it("read a task's day in the viewer's time zone", () => {
    const task = mine({ dueDate: "2026-11-08", dueTime: "23:30", endTime: null, timeZone: "UTC" });
    const [entry] = dueSoon([task], ME, NOW, "Asia/Tokyo");
    expect(entry?.day).toBe("2026-11-09");
    expect(entry?.when).toBe("tomorrow");
  });

  it("take today from the viewer's time zone", () => {
    const late = new Date("2026-11-08T22:00:00.000Z");
    const [entry] = dueSoon([mine({ dueDate: "2026-11-08" })], ME, late, "Asia/Tokyo");
    expect(entry?.when).toBe("overdue");
  });
});

describe("the order of the tasks due soon", () => {
  it("puts overdue tasks first, the oldest first", () => {
    const list = dueSoon([
      mine({ title: "today", dueDate: "2026-11-08", dueTime: "09:00" }),
      mine({ title: "week ago", dueDate: "2026-11-01" }),
      mine({ title: "three days ago", dueDate: "2026-11-05" }),
    ], ME, NOW, ZONE);
    expect(titles(list)).toEqual(["week ago", "three days ago", "today"]);
  });

  it("orders one day by time and puts tasks without a time last", () => {
    const list = dueSoon([
      mine({ title: "no time", dueDate: "2026-11-08", dueTime: null }),
      mine({ title: "afternoon", dueDate: "2026-11-08", dueTime: "15:00", endTime: null }),
      mine({ title: "morning", dueDate: "2026-11-08", dueTime: "09:00", endTime: null }),
    ], ME, NOW, ZONE);
    expect(titles(list)).toEqual(["morning", "afternoon", "no time"]);
  });

  it("orders the same moment by priority, most urgent first", () => {
    const list = dueSoon([
      mine({ title: "low", dueDate: "2026-11-08", priority: "LOW" }),
      mine({ title: "urgent", dueDate: "2026-11-08", priority: "URGENT" }),
      mine({ title: "high", dueDate: "2026-11-08", priority: "HIGH" }),
    ], ME, NOW, ZONE);
    expect(titles(list)).toEqual(["urgent", "high", "low"]);
  });
});
