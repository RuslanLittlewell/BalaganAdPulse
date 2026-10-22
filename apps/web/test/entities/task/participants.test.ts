import {
  NO_PARTICIPANTS,
  participantChoices,
  participantsOf,
  tasksOfParticipants,
  type Task,
} from "@/entities/task/index.js";

const task = (partial: Partial<Task> = {}): Task => ({
  id: "t1", projectId: null, orgId: "org1", title: "Задача", description: null,
  column: "IDEA", priority: "MEDIUM", createdById: null, participantIds: [],
  visibleToClient: false, position: 0, dueDate: null, dueTime: null, endTime: null, repeatEvery: "NONE", isCall: false,
  checklist: [], imageIds: [],
  archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

const member = (id: string, name: string) => ({ id, name });
const members = [member("m1", "Пётр"), member("m2", "Анна"), member("m3", "Мария")];

describe("who the participant filter offers", () => {
  it("offers each member taking part in a visible task once, ordered by name", () => {
    const choices = participantChoices(
      [task({ id: "a", participantIds: ["m1", "m2"] }), task({ id: "b", participantIds: ["m1"] })],
      members,
    );
    expect(choices.map((choice) => choice.name)).toEqual(["Анна", "Пётр"]);
  });

  it("offers Без участников last while a task has nobody", () => {
    const choices = participantChoices([task({ id: "a", participantIds: ["m1"] }), task({ id: "b" })], members);
    expect(choices.map((choice) => choice.id)).toEqual(["m1", NO_PARTICIPANTS]);
  });

  it("does not offer it when every task has somebody", () => {
    const choices = participantChoices([task({ participantIds: ["m1"] })], members);
    expect(choices.some((choice) => choice.id === NO_PARTICIPANTS)).toBe(false);
  });

  it("keeps a chosen member listed after their last task is gone", () => {
    const choices = participantChoices([task({ participantIds: ["m1"] })], members, ["m3"]);
    expect(choices.map((choice) => choice.id)).toEqual(["m3", "m1"]);
  });

  it("names a member it cannot find by their id", () => {
    const choices = participantChoices([task({ participantIds: ["stranger"] })], members);
    expect(choices).toEqual([{ id: "stranger", name: "stranger", member: undefined }]);
  });
});

describe("narrowing tasks to chosen participants", () => {
  const board = [
    task({ id: "a", participantIds: ["m1"] }),
    task({ id: "b", participantIds: ["m2"] }),
    task({ id: "c", participantIds: ["m1", "m2"] }),
    task({ id: "d" }),
  ];
  const ids = (tasks: Task[]) => tasks.map((held) => held.id);

  it("keeps every task when nobody is chosen", () => {
    expect(ids(tasksOfParticipants(board, []))).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps every task one chosen member takes part in", () => {
    expect(ids(tasksOfParticipants(board, ["m2"]))).toEqual(["b", "c"]);
  });

  it("keeps the tasks of either chosen member", () => {
    expect(ids(tasksOfParticipants(board, ["m1", "m2"]))).toEqual(["a", "b", "c"]);
  });

  it("keeps the tasks nobody takes part in when Без участников is chosen", () => {
    expect(ids(tasksOfParticipants(board, [NO_PARTICIPANTS]))).toEqual(["d"]);
  });
});

describe("the people of a task", () => {
  it("are the members named on it, in its order, leaving out those not at hand", () => {
    const people = participantsOf(task({ participantIds: ["m2", "nobody", "m1"] }), members);
    expect(people.map((person) => person.name)).toEqual(["Анна", "Пётр"]);
  });

  it("are found in a map of members as well", () => {
    const byId = new Map(members.map((held) => [held.id, held]));
    expect(participantsOf(task({ participantIds: ["m3"] }), byId).map((person) => person.name)).toEqual(["Мария"]);
  });
});
