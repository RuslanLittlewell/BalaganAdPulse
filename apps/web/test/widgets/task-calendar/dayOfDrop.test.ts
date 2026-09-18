import { dayOfDrop, tasksOfDay } from "@/widgets/task-calendar/index.js";

const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];

const tasks = [
  { id: "a", dueDate: "2026-09-16", dueTime: "12:00", position: 0 },
  { id: "b", dueDate: "2026-09-16", dueTime: null, position: 1 },
  { id: "c", dueDate: null, dueTime: null, position: 2 },
];

describe("the day a card is dropped on", () => {
  it("is the day column it was dropped into", () => {
    expect(dayOfDrop(week, tasks, "2026-09-18")).toBe("2026-09-18");
  });

  it("is the day of the card it was dropped onto", () => {
    expect(dayOfDrop(week, tasks, "a")).toBe("2026-09-16");
  });

  it("is nowhere when the card it was dropped onto has no day", () => {
    expect(dayOfDrop(week, tasks, "c")).toBeNull();
  });

  it("is nowhere when it was dropped on nothing known", () => {
    expect(dayOfDrop(week, tasks, "somewhere-else")).toBeNull();
  });
});

describe("the order of a day's tasks", () => {
  it("puts the earliest time first and the untimed last", () => {
    const day = tasksOfDay([
      { dueDate: "2026-09-16", dueTime: null, position: 0 },
      { dueDate: "2026-09-16", dueTime: "15:00", position: 1 },
      { dueDate: "2026-09-16", dueTime: "09:30", position: 2 },
    ], "2026-09-16");
    expect(day.map((task) => task.dueTime)).toEqual(["09:30", "15:00", null]);
  });

  it("falls back on the board's own order for two tasks at the same time", () => {
    const day = tasksOfDay([
      { dueDate: "2026-09-16", dueTime: "09:30", position: 3 },
      { dueDate: "2026-09-16", dueTime: "09:30", position: 1 },
    ], "2026-09-16");
    expect(day.map((task) => task.position)).toEqual([1, 3]);
  });

  it("holds only the tasks due that day", () => {
    expect(tasksOfDay(tasks, "2026-09-16").map((task) => task.id)).toEqual(["a", "b"]);
  });
});
