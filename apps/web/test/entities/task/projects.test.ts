import {
  NO_PROJECT_TASK,
  projectChoices,
  tasksOfProjects,
  type Task,
} from "@/entities/task/index.js";

const task = (partial: Partial<Task> = {}): Task => ({
  id: "t1", projectId: null, orgId: "org1", title: "Задача", description: null,
  column: "IDEA", priority: "MEDIUM", createdById: null,
  visibleToClient: false, position: 0, dueDate: null, dueTime: null, endTime: null, participantIds: [], repeatEvery: "NONE", isCall: false,
  checklist: [], imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

const project = (id: string, name: string) => ({ id, name });

const projects = [project("p1", "Сайт"), project("p2", "Магазин"), project("p3", "Лендинг")];

describe("which projects the filter offers", () => {
  it("offers each project of a visible task once, ordered by name", () => {
    const choices = projectChoices(
      [task({ id: "a", projectId: "p1" }), task({ id: "b", projectId: "p2" }),
       task({ id: "c", projectId: "p1" })],
      projects,
    );

    expect(choices.map((choice) => choice.name)).toEqual(["Магазин", "Сайт"]);
    expect(choices.map((choice) => choice.project?.id)).toEqual(["p2", "p1"]);
  });

  it("offers no project that no visible task belongs to", () => {
    const choices = projectChoices([task({ projectId: "p1" })], projects);

    expect(choices.map((choice) => choice.id)).toEqual(["p1"]);
  });

  it("offers Без проекта last while a task has no project", () => {
    const choices = projectChoices([task({ id: "a", projectId: "p1" }), task({ id: "b" })], projects);

    expect(choices.map((choice) => choice.id)).toEqual(["p1", NO_PROJECT_TASK]);
  });

  it("does not offer Без проекта when every task has a project", () => {
    const choices = projectChoices([task({ projectId: "p1" })], projects);

    expect(choices.some((choice) => choice.id === NO_PROJECT_TASK)).toBe(false);
  });

  it("keeps a chosen project listed after its last task is gone", () => {
    const choices = projectChoices([task({ projectId: "p1" })], projects, ["p3", NO_PROJECT_TASK]);

    expect(choices.map((choice) => choice.id)).toEqual(["p3", "p1", NO_PROJECT_TASK]);
  });
});

describe("narrowing tasks to chosen projects", () => {
  const board = [
    task({ id: "a", projectId: "p1" }),
    task({ id: "b", projectId: "p2" }),
    task({ id: "c", projectId: null }),
  ];
  const ids = (tasks: Task[]) => tasks.map((held) => held.id);

  it("keeps every task when nothing is chosen", () => {
    expect(ids(tasksOfProjects(board, []))).toEqual(["a", "b", "c"]);
  });

  it("keeps the tasks of one chosen project", () => {
    expect(ids(tasksOfProjects(board, ["p1"]))).toEqual(["a"]);
  });

  it("keeps the tasks of every chosen project", () => {
    expect(ids(tasksOfProjects(board, ["p1", "p2"]))).toEqual(["a", "b"]);
  });

  it("keeps the tasks with no project when Без проекта is chosen", () => {
    expect(ids(tasksOfProjects(board, [NO_PROJECT_TASK]))).toEqual(["c"]);
  });
});
