import { layoutDay, spanOfTask, startKeepingWithinDay } from "@/widgets/task-calendar/index.js";

const at = (id: string, dueTime: string, endTime: string | null = null) => ({ id, dueTime, endTime });

const placement = (tasks: ReturnType<typeof at>[]) =>
  Object.fromEntries(layoutDay(tasks).map(({ task, start, end, lane, lanes }) =>
    [task.id, { start, end, lane, lanes }]));

describe("the time a calendar card spans", () => {
  it("runs from the start to the end", () => {
    expect(spanOfTask(at("a", "10:00", "10:30"))).toEqual({ start: 600, end: 630 });
  });

  it("is an hour long when the task has no end", () => {
    expect(spanOfTask(at("a", "12:00"))).toEqual({ start: 720, end: 780 });
  });

  it("stops at midnight", () => {
    expect(spanOfTask(at("a", "23:30"))).toEqual({ start: 1410, end: 1440 });
    expect(spanOfTask(at("a", "22:00", "24:00"))).toEqual({ start: 1320, end: 1440 });
  });

  it("is nothing for a task with no time of day", () => {
    expect(spanOfTask({ dueTime: null, endTime: null })).toBeNull();
  });
});

describe("laying out a day", () => {
  it("draws a lone task at full width", () => {
    expect(placement([at("a", "12:00", "13:00")]).a).toEqual({ start: 720, end: 780, lane: 0, lanes: 1 });
  });

  it("puts two tasks at the same hour side by side", () => {
    const placed = placement([at("a", "12:00", "13:00"), at("b", "12:00", "13:00")]);
    expect([placed.a.lane, placed.b.lane].sort()).toEqual([0, 1]);
    expect(placed.a.lanes).toBe(2);
    expect(placed.b.lanes).toBe(2);
  });

  it("lets the first and the third of a chain share a place", () => {
    const placed = placement([at("a", "09:00", "11:00"), at("b", "10:00", "12:00"), at("c", "11:00", "13:00")]);
    expect(placed.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(placed.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(placed.c).toMatchObject({ lane: 0, lanes: 2 });
  });

  it("keeps back-to-back tasks at full width", () => {
    const placed = placement([at("a", "12:00", "13:00"), at("b", "13:00", "14:00")]);
    expect(placed.a).toMatchObject({ lane: 0, lanes: 1 });
    expect(placed.b).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("counts a task with no end as an hour when judging overlap", () => {
    const placed = placement([at("a", "12:00"), at("b", "12:30", "12:45"), at("c", "13:00", "14:00")]);
    expect(placed.a).toMatchObject({ lanes: 2 });
    expect(placed.b).toMatchObject({ lanes: 2 });
    expect(placed.c).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("gives a later cluster its own count of places", () => {
    const placed = placement([
      at("a", "09:00", "10:00"), at("b", "09:00", "10:00"), at("c", "09:30", "10:00"),
      at("d", "15:00", "16:00"),
    ]);
    expect(placed.a.lanes).toBe(3);
    expect(placed.d).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("leaves out tasks with no time of day", () => {
    expect(layoutDay([{ dueTime: null, endTime: null }])).toEqual([]);
  });
});

describe("keeping a dropped task within its day", () => {
  it("leaves a start that fits", () => {
    expect(startKeepingWithinDay(at("a", "12:00", "13:30"), 15 * 60)).toBe(15 * 60);
  });

  it("pulls a start back so the end stays at midnight", () => {
    expect(startKeepingWithinDay(at("a", "12:00", "14:00"), 23 * 60)).toBe(22 * 60);
  });

  it("leaves a task with no end where it is dropped", () => {
    expect(startKeepingWithinDay(at("a", "12:00"), 23 * 60 + 30)).toBe(23 * 60 + 30);
  });
});
