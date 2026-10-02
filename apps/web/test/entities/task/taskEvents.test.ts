import { describe, expect, it } from "vitest";
import { applyTaskEvent } from "@/entities/task/api/queries.js";
import type { Task } from "@/entities/task/api/api.js";

const task = (partial: Partial<Task> = {}): Task => ({
  id: "t1", projectId: "p1", orgId: "org1", title: "Write the brief", description: null,
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: "m1",
  visibleToClient: false, position: 0,
  dueDate: null, dueTime: null, repeatEvery: "NONE", checklist: [],
  imageIds: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

describe("applying an event another member caused", () => {
  it("adds a task the board has not seen", () => {
    const board = [task({ id: "a" })];
    const next = applyTaskEvent(board, {
      kind: "task.created", orgId: "org1", projectId: "p1",
      task: task({ id: "b", column: "DONE" }),
    });
    expect(next.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("replaces a task it already holds", () => {
    const board = [task({ id: "a", title: "Old" })];
    const next = applyTaskEvent(board, {
      kind: "task.updated", orgId: "org1", projectId: "p1",
      task: task({ id: "a", title: "New" }),
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.title).toBe("New");
  });

  it("renumbers both columns around a move", () => {
    const board = [
      task({ id: "a", column: "IDEA", position: 0 }),
      task({ id: "b", column: "IDEA", position: 1 }),
      task({ id: "c", column: "DONE", position: 0 }),
    ];

    const next = applyTaskEvent(board, {
      kind: "task.moved", orgId: "org1", projectId: "p1",
      task: task({ id: "a", column: "DONE", position: 0 }),
    });

    const at = (id: string) => next.find((t) => t.id === id)!;
    expect(at("a")).toMatchObject({ column: "DONE", position: 0 });
    expect(at("c")).toMatchObject({ column: "DONE", position: 1 });
    expect(at("b")).toMatchObject({ column: "IDEA", position: 0 });
  });

  it("adds a task moved into view that the board had never seen", () => {
    const board = [task({ id: "a", column: "DONE", position: 0 })];
    const next = applyTaskEvent(board, {
      kind: "task.moved", orgId: "org1", projectId: "p1",
      task: task({ id: "z", column: "DONE", position: 0 }),
    });
    expect(next.map((t) => t.id).sort()).toEqual(["a", "z"]);
  });

  it("removes a deleted task", () => {
    const board = [task({ id: "a" }), task({ id: "b" })];
    const next = applyTaskEvent(board, {
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "a",
    });
    expect(next.map((t) => t.id)).toEqual(["b"]);
  });

  it("closes the gap a deletion leaves in its column", () => {
    const board = [
      task({ id: "a", column: "IDEA", position: 0 }),
      task({ id: "b", column: "IDEA", position: 1 }),
      task({ id: "c", column: "IDEA", position: 2 }),
    ];
    const next = applyTaskEvent(board, {
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "a",
    });
    expect(next.map((t) => t.position)).toEqual([0, 1]);
  });

  it("ignores a delete for a task it does not hold", () => {
    const board = [task({ id: "a" })];
    expect(applyTaskEvent(board, {
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "zzz",
    })).toEqual(board);
  });

  it("is idempotent for an event the board already reflects", () => {
    const board = [
      task({ id: "a", column: "DONE", position: 0 }),
      task({ id: "b", column: "IDEA", position: 0 }),
    ];
    const event = {
      kind: "task.moved", orgId: "org1", projectId: "p1",
      task: task({ id: "a", column: "DONE", position: 0 }),
    } as const;

    expect(applyTaskEvent(applyTaskEvent(board, event), event))
      .toEqual(applyTaskEvent(board, event));
  });
});

describe("folding an event into a filtered listing", () => {
  const listing = [task({ id: "a", projectId: "p1" })];
  const onProject = { projectId: "p1" };

  const created = (t: Task) =>
    ({ kind: "task.created", orgId: "org1", projectId: t.projectId, task: t }) as const;

  it("ignores a task belonging to another project", () => {
    const stranger = task({ id: "b", projectId: "p2" });

    expect(applyTaskEvent(listing, created(stranger), onProject)).toBe(listing);
  });

  it("takes in a task that belongs", () => {
    const arriving = task({ id: "b", projectId: "p1", position: 1 });

    expect(applyTaskEvent(listing, created(arriving), onProject).map((t) => t.id))
      .toEqual(["a", "b"]);
  });

  it("drops a task that moved to another project", () => {
    const moved = task({ id: "a", projectId: "p2" });

    expect(applyTaskEvent(listing, { ...created(moved), kind: "task.updated" }, onProject))
      .toEqual([]);
  });

  it("still removes a deleted task, whatever the filter says", () => {
    const event = { kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "a" } as const;

    expect(applyTaskEvent(listing, event, onProject)).toEqual([]);
  });

  it("takes in everything when the listing is not filtered", () => {
    const stranger = task({ id: "b", projectId: "p2" });

    expect(applyTaskEvent(listing, created(stranger)).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("takes in another task on the same project listing", () => {
    const general = task({ id: "b", projectId: "p1", visibleToClient: false, position: 1 });

    expect(applyTaskEvent(listing, created(general), onProject).map((t) => t.id))
      .toEqual(["a", "b"]);
  });
});
