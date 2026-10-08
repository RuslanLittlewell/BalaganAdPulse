import {
  UNASSIGNED_TASK,
  assigneeChoices,
  tasksOfAssignees,
  type Task,
} from "@/entities/task/index.js";

const task = (partial: Partial<Task> = {}): Task => ({
  id: "t1", projectId: null, orgId: "org1", title: "Задача", description: null,
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: null,
  visibleToClient: false, position: 0, dueDate: null, dueTime: null, repeatEvery: "NONE",
  checklist: [], imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

const member = (id: string, name: string) => ({ id, name });

describe("who the filter offers", () => {
  it("offers each member responsible for a visible task, once", () => {
    const choices = assigneeChoices(
      [task({ id: "a", assigneeId: "m1" }), task({ id: "b", assigneeId: "m2" }),
       task({ id: "c", assigneeId: "m1" })],
      [member("m1", "Пётр"), member("m2", "Анна")],
    );

    expect(choices).toHaveLength(2);
    expect(choices.map((choice) => choice.id).sort()).toEqual(["m1", "m2"]);
  });

  it("orders the people by name, so the list reads the same however the board is sorted", () => {
    const choices = assigneeChoices(
      [task({ id: "a", assigneeId: "m1" }), task({ id: "b", assigneeId: "m2" })],
      [member("m1", "Пётр"), member("m2", "Анна")],
    );

    expect(choices.map((choice) => choice.name)).toEqual(["Анна", "Пётр"]);
  });

  it("names them from the memberships in hand", () => {
    const choices = assigneeChoices([task({ assigneeId: "m1" })], [member("m1", "Пётр")]);

    expect(choices[0]).toMatchObject({ id: "m1", name: "Пётр" });
  });

  it("offers nobody the board does not show", () => {
    const choices = assigneeChoices(
      [task({ assigneeId: "m1" })],
      [member("m1", "Пётр"), member("m2", "Анна")],
    );

    expect(choices.map((choice) => choice.id)).toEqual(["m1"]);
  });

  it("falls back to the id when no membership is in hand, so no task is unreachable", () => {
    const choices = assigneeChoices([task({ assigneeId: "m9" })], []);

    expect(choices).toEqual([{ id: "m9", name: "m9", member: undefined }]);
  });

  it("offers the unassigned entry while work nobody holds is visible", () => {
    const choices = assigneeChoices(
      [task({ id: "a", assigneeId: "m1" }), task({ id: "b", assigneeId: null })],
      [member("m1", "Пётр")],
    );

    expect(choices.map((choice) => choice.id)).toEqual(["m1", UNASSIGNED_TASK]);
  });

  it("offers no unassigned entry when every visible task is held", () => {
    const choices = assigneeChoices([task({ assigneeId: "m1" })], [member("m1", "Пётр")]);

    expect(choices.map((choice) => choice.id)).not.toContain(UNASSIGNED_TASK);
  });

  it("keeps a chosen member who no longer holds a visible task", () => {
    const choices = assigneeChoices([task({ assigneeId: "m1" })], [member("m1", "Пётр"), member("m2", "Анна")], ["m2"]);

    expect(choices.map((choice) => choice.id).sort()).toEqual(["m1", "m2"]);
  });

  it("keeps a chosen unassigned entry when the last unheld task is gone", () => {
    const choices = assigneeChoices([task({ assigneeId: "m1" })], [member("m1", "Пётр")], [UNASSIGNED_TASK]);

    expect(choices.map((choice) => choice.id)).toContain(UNASSIGNED_TASK);
  });
});

describe("narrowing the tasks to whoever was chosen", () => {
  const board = [
    task({ id: "a", assigneeId: "m1" }),
    task({ id: "b", assigneeId: "m2" }),
    task({ id: "c", assigneeId: null }),
  ];

  it("shows everything while nobody is chosen", () => {
    expect(tasksOfAssignees(board, [])).toBe(board);
  });

  it("shows one chosen member's work alone", () => {
    expect(tasksOfAssignees(board, ["m1"]).map((held) => held.id)).toEqual(["a"]);
  });

  it("shows the work of everyone chosen", () => {
    expect(tasksOfAssignees(board, ["m1", "m2"]).map((held) => held.id)).toEqual(["a", "b"]);
  });

  it("shows the work nobody holds when the unassigned entry is chosen", () => {
    expect(tasksOfAssignees(board, [UNASSIGNED_TASK]).map((held) => held.id)).toEqual(["c"]);
  });

  it("shows a member's work beside the unheld work when both are chosen", () => {
    expect(tasksOfAssignees(board, ["m2", UNASSIGNED_TASK]).map((held) => held.id))
      .toEqual(["b", "c"]);
  });

  it("shows nothing for a chosen member who holds none of it", () => {
    expect(tasksOfAssignees(board, ["m9"])).toEqual([]);
  });
});
