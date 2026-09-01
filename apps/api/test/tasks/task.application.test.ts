import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { TASK_COLUMNS, createTaskUseCases, type TaskEvent, type TaskRecord } from "../../src/modules/tasks/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { ...admin, membershipId: "m2", role: "MANAGER" };
const guest: ActorContext = { ...admin, membershipId: "m3", role: "GUEST" };
const customer: ActorContext = { ...admin, membershipId: "m4", role: "CLIENT" };

const task = (partial: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "t1", projectId: "p1", orgId: "org1", title: "Write the brief", description: null,
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: "m1", position: 0,
  createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...partial,
});

function fixture(options: {
  tasks?: TaskRecord[];
  reachableProjects?: string[];
  assignable?: string[];
  /** Makes the transaction fail after the work has run, so a caller can prove
   * what does and does not survive a rollback. */
  failCommit?: boolean;
} = {}) {
  const context = {} as TransactionContext;
  const tasks = new Map((options.tasks ?? []).map((t) => [t.id, t]));
  const reachableProjects = options.reachableProjects ?? ["p1"];
  const assignable = options.assignable ?? ["m2"];
  const audit: Array<Record<string, unknown>> = [];
  const orders: Array<{ column: string; ids: string[] }> = [];
  const claimed: Array<{ taskId: string; imageIds: string[] }> = [];
  const removedObjects: string[] = [];
  const published: TaskEvent[] = [];
  // One ordered log of both, so a test can prove the event follows the commit
  // rather than merely that both happened.
  const journal: string[] = [];

  const useCases = createTaskUseCases({
    tasks: {
      create: async (_tx, input) => { const created = task(input); tasks.set(created.id, created); return created; },
      findReachable: async (_actor, id) => tasks.get(id) ?? null,
      listReachable: async (_actor, projectId) =>
        [...tasks.values()]
          .filter((t) => !projectId || t.projectId === projectId)
          // By the board's column order, not alphabetically — the same order
          // the enum gives the real query.
          .sort((a, b) =>
            TASK_COLUMNS.indexOf(a.column) - TASK_COLUMNS.indexOf(b.column) || a.position - b.position),
      update: async (_tx, id, input) => {
        const updated = { ...tasks.get(id)!, ...input };
        tasks.set(id, updated);
        return updated;
      },
      delete: async (_tx, id) => { tasks.delete(id); },
      countInColumn: async (_orgId, column) =>
        [...tasks.values()].filter((t) => t.column === column).length,
      columnIds: async (_orgId, column) =>
        [...tasks.values()].filter((t) => t.column === column)
          .sort((a, b) => a.position - b.position).map((t) => t.id),
      applyOrder: async (_tx, column, ids) => {
        orders.push({ column, ids: [...ids] });
        ids.forEach((id, index) => {
          const existing = tasks.get(id);
          if (existing) tasks.set(id, { ...existing, column: column as TaskRecord["column"], position: index });
        });
      },
    },
    images: {
      create: async (_tx, input) => ({ ...input, createdAt: new Date("2026-09-01T00:00:00.000Z") }),
      findById: async () => null,
      listForTask: async () => [],
      claim: async (_tx, taskId, _uploaderId, imageIds) => { claimed.push({ taskId, imageIds: [...imageIds] }); },
      deleteMany: async () => undefined,
    },
    imageStorage: {
      put: async () => undefined,
      get: async () => ({ body: new Uint8Array(), contentType: "image/png" }),
      remove: async (keys) => { removedObjects.push(...keys); },
    },
    projects: {
      contextFor: async (_actor, projectId) =>
        reachableProjects.includes(projectId) ? { clientId: "c1" } : null,
    },
    members: { isAssignable: async (_actor, membershipId) => assignable.includes(membershipId) },
    audit: { append: async (_tx, event) => { audit.push(event as never); } },
    events: {
      publish: (event: TaskEvent) => { published.push(event); journal.push(`publish:${event.kind}`); },
    },
    ids: new DeterministicIdGenerator(["new-1", "new-2", "new-3"]),
    unitOfWork: {
      run: async (work) => {
        const result = await work(context);
        if (options.failCommit) throw new Error("commit failed");
        journal.push("commit");
        return result;
      },
    },
  });
  return { useCases, tasks, audit, orders, claimed, removedObjects, published, journal };
}

describe("reading the board", () => {
  it("returns tasks ordered by column then position", async () => {
    const { useCases } = fixture({ tasks: [
      task({ id: "b", column: "DONE", position: 0 }),
      task({ id: "a", column: "IDEA", position: 1 }),
      task({ id: "c", column: "IDEA", position: 0 }),
    ] });
    expect((await useCases.list(admin)).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("narrows to one project on request", async () => {
    const { useCases } = fixture({ tasks: [task({ id: "a" }), task({ id: "b", projectId: "p2" })] });
    expect((await useCases.list(admin, "p2")).map((t) => t.id)).toEqual(["b"]);
  });

  it("lets a guest read the board", async () => {
    const { useCases } = fixture({ tasks: [task()] });
    await expect(useCases.list(guest)).resolves.toHaveLength(1);
  });

  it("refuses a client-role member the board entirely", async () => {
    const { useCases } = fixture({ tasks: [task()] });
    await expect(useCases.list(customer)).rejects.toMatchObject({ category: "forbidden" });
    await expect(useCases.read(customer, "t1")).rejects.toMatchObject({ category: "forbidden" });
  });

  it("answers not-found for a task out of reach", async () => {
    const { useCases } = fixture();
    await expect(useCases.read(admin, "missing")).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("creating a task", () => {
  it("lands in IDEA at the end of that column", async () => {
    const { useCases } = fixture({ tasks: [task({ id: "a", column: "IDEA", position: 0 })] });
    const created = await useCases.create(admin, { projectId: "p1", title: "Next", priority: "LOW" });
    expect(created).toMatchObject({ column: "IDEA", position: 1, title: "Next" });
  });

  it("records who created it", async () => {
    const { useCases } = fixture();
    const created = await useCases.create(manager, { projectId: "p1", title: "T", priority: "LOW" });
    expect(created.createdById).toBe("m2");
  });

  it("refuses a blank title", async () => {
    const { useCases, tasks } = fixture();
    await expect(useCases.create(admin, { projectId: "p1", title: "   ", priority: "LOW" }))
      .rejects.toMatchObject({ category: "validation" });
    expect(tasks.size).toBe(0);
  });

  it("answers not-found for a project out of reach", async () => {
    const { useCases } = fixture({ reachableProjects: [] });
    await expect(useCases.create(admin, { projectId: "p1", title: "T", priority: "LOW" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses an unknown column", async () => {
    const { useCases } = fixture();
    await expect(useCases.create(admin, { projectId: "p1", title: "T", priority: "LOW", column: "BACKLOG" as never }))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("refuses an assignee who is not an active member here", async () => {
    const { useCases, tasks } = fixture({ assignable: [] });
    await expect(useCases.create(admin, { projectId: "p1", title: "T", priority: "LOW", assigneeId: "m9" }))
      .rejects.toMatchObject({ category: "validation" });
    expect(tasks.size).toBe(0);
  });

  it("accepts an assignee who is one", async () => {
    const { useCases } = fixture();
    const created = await useCases.create(admin, { projectId: "p1", title: "T", priority: "LOW", assigneeId: "m2" });
    expect(created.assigneeId).toBe("m2");
  });

  it("refuses a guest", async () => {
    const { useCases } = fixture();
    await expect(useCases.create(guest, { projectId: "p1", title: "T", priority: "LOW" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });

  it("audits the creation against its client and project", async () => {
    const { useCases, audit } = fixture();
    const created = await useCases.create(admin, { projectId: "p1", title: "Brief", priority: "LOW" });
    expect(audit[0]).toMatchObject({
      action: "CREATE", entityType: "task", entityId: created.id,
      clientId: "c1", projectId: "p1", summary: 'Created task “Brief”',
    });
  });
});

describe("changing a task", () => {
  it("changes the title without moving it", async () => {
    const { useCases, tasks } = fixture({ tasks: [task({ position: 3, column: "IN_REVIEW" })] });
    await useCases.update(admin, "t1", { title: "Renamed" });
    expect(tasks.get("t1")).toMatchObject({ title: "Renamed", position: 3, column: "IN_REVIEW" });
  });

  it("clears the assignee", async () => {
    const { useCases, tasks } = fixture({ tasks: [task({ assigneeId: "m2" })] });
    await useCases.update(admin, "t1", { assigneeId: null });
    expect(tasks.get("t1")!.assigneeId).toBeNull();
  });

  it("moves it to another reachable project", async () => {
    const { useCases, tasks } = fixture({ tasks: [task()], reachableProjects: ["p1", "p2"] });
    await useCases.update(admin, "t1", { projectId: "p2" });
    expect(tasks.get("t1")!.projectId).toBe("p2");
  });

  it("answers not-found for a project out of reach", async () => {
    const { useCases } = fixture({ tasks: [task()] });
    await expect(useCases.update(admin, "t1", { projectId: "elsewhere" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest", async () => {
    const { useCases } = fixture({ tasks: [task()] });
    await expect(useCases.update(guest, "t1", { title: "x" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });

  it("answers not-found before it checks the role, so reach is never disclosed", async () => {
    const { useCases } = fixture();
    await expect(useCases.update(guest, "missing", { title: "x" }))
      .rejects.toMatchObject({ category: "not-found" });
  });
});

describe("deleting a task", () => {
  it("removes it and closes the gap in its column", async () => {
    const { useCases, tasks, orders } = fixture({ tasks: [
      task({ id: "a", position: 0 }), task({ id: "b", position: 1 }), task({ id: "c", position: 2 }),
    ] });
    await useCases.delete(admin, "b");
    expect(tasks.has("b")).toBe(false);
    expect(orders).toEqual([{ column: "IDEA", ids: ["a", "c"] }]);
  });

  it("is permitted to a manager as well as an admin", async () => {
    const { useCases } = fixture({ tasks: [task()] });
    await expect(useCases.delete(manager, "t1")).resolves.toBeUndefined();
  });

  it("is refused to a guest", async () => {
    const { useCases, tasks } = fixture({ tasks: [task()] });
    await expect(useCases.delete(guest, "t1")).rejects.toMatchObject({ category: "forbidden" });
    expect(tasks.has("t1")).toBe(true);
  });
});

describe("moving a card", () => {
  it("renumbers both columns densely from zero", async () => {
    const { useCases, orders } = fixture({ tasks: [
      task({ id: "a", column: "IDEA", position: 0 }),
      task({ id: "b", column: "IDEA", position: 1 }),
      task({ id: "x", column: "IN_REVIEW", position: 0 }),
      task({ id: "y", column: "IN_REVIEW", position: 1 }),
    ] });
    await useCases.move(admin, "a", { column: "IN_REVIEW", position: 1 });

    expect(orders).toEqual([
      { column: "IDEA", ids: ["b"] },
      { column: "IN_REVIEW", ids: ["x", "a", "y"] },
    ]);
  });

  it("reorders within one column without touching another", async () => {
    const { useCases, orders } = fixture({ tasks: [
      task({ id: "a", position: 0 }), task({ id: "b", position: 1 }), task({ id: "c", position: 2 }),
    ] });
    await useCases.move(admin, "c", { column: "IDEA", position: 0 });
    expect(orders).toEqual([{ column: "IDEA", ids: ["c", "a", "b"] }]);
  });

  it("clamps a position past the end of the target column", async () => {
    const { useCases, orders } = fixture({ tasks: [
      task({ id: "a", column: "IDEA", position: 0 }),
      task({ id: "x", column: "DONE", position: 0 }),
    ] });
    await useCases.move(admin, "a", { column: "DONE", position: 99 });
    expect(orders.at(-1)).toEqual({ column: "DONE", ids: ["x", "a"] });
  });

  it("refuses an unknown column and moves nothing", async () => {
    const { useCases, orders } = fixture({ tasks: [task()] });
    await expect(useCases.move(admin, "t1", { column: "BACKLOG" as never, position: 0 }))
      .rejects.toMatchObject({ category: "validation" });
    expect(orders).toEqual([]);
  });

  it("refuses a guest and moves nothing", async () => {
    const { useCases, orders } = fixture({ tasks: [task()] });
    await expect(useCases.move(guest, "t1", { column: "DONE", position: 0 }))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(orders).toEqual([]);
  });

  it("records the columns it moved between", async () => {
    const { useCases, audit } = fixture({ tasks: [task({ id: "a", column: "IN_PROGRESS" })] });
    await useCases.move(admin, "a", { column: "DONE", position: 0 });
    expect(audit.at(-1)).toMatchObject({
      action: "UPDATE", entityType: "task", entityId: "a",
      summary: "Moved task “Write the brief” from IN_PROGRESS to DONE",
    });
  });
});

describe("images referenced by a description", () => {
  it("are claimed for the task when it is created", async () => {
    const { useCases, claimed } = fixture();
    const description = { type: "doc", content: [{ type: "taskImage", attrs: { imageId: "img-1" } }] };
    const created = await useCases.create(admin, { projectId: "p1", title: "T", priority: "LOW", description });
    expect(claimed).toEqual([{ taskId: created.id, imageIds: ["img-1"] }]);
  });

  it("are claimed again when the description is edited", async () => {
    const { useCases, claimed } = fixture({ tasks: [task()] });
    await useCases.update(admin, "t1", {
      description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId: "img-2" } }] },
    });
    expect(claimed).toEqual([{ taskId: "t1", imageIds: ["img-2"] }]);
  });

  it("are left alone when an edit does not touch the description", async () => {
    const { useCases, claimed } = fixture({ tasks: [task()] });
    await useCases.update(admin, "t1", { title: "Renamed" });
    expect(claimed).toEqual([]);
  });
});


describe("telling other members what happened", () => {
  it("publishes one event per committed change, naming what happened", async () => {
    const { useCases, published } = fixture({ tasks: [task({ id: "t1" })] });

    await useCases.create(admin, { projectId: "p1", title: "New", priority: "LOW" });
    await useCases.update(admin, "t1", { title: "Renamed" });
    await useCases.move(admin, "t1", { column: "DONE", position: 0 });
    await useCases.delete(admin, "t1");

    expect(published.map((event) => event.kind)).toEqual([
      "task.created", "task.updated", "task.moved", "task.deleted",
    ]);
  });

  // The order is the whole point. Publishing inside the transaction would tell
  // every recipient about work that can still roll back, and nothing would
  // correct them until they reconnected.
  it("publishes only after the transaction has committed", async () => {
    const { useCases, journal } = fixture();
    await useCases.create(admin, { projectId: "p1", title: "New", priority: "LOW" });
    expect(journal).toEqual(["commit", "publish:task.created"]);
  });

  it("publishes nothing when the change is rolled back", async () => {
    const { useCases, published } = fixture({
      tasks: [task({ id: "t1" })], failCommit: true,
    });

    await expect(useCases.create(admin, { projectId: "p1", title: "New", priority: "LOW" }))
      .rejects.toThrow();
    await expect(useCases.update(admin, "t1", { title: "Renamed" })).rejects.toThrow();
    await expect(useCases.move(admin, "t1", { column: "DONE", position: 0 })).rejects.toThrow();
    await expect(useCases.delete(admin, "t1")).rejects.toThrow();

    expect(published).toEqual([]);
  });

  it("publishes the move's own placement, not a re-read", async () => {
    const { useCases, published } = fixture({ tasks: [
      task({ id: "t1", column: "IDEA", position: 0 }),
      task({ id: "t2", column: "DONE", position: 0 }),
    ] });

    await useCases.move(admin, "t1", { column: "DONE", position: 0 });

    const event = published[0]!;
    expect(event.kind).toBe("task.moved");
    // The repository reads run outside the transaction and would still report
    // the card in IDEA; the event must carry where the move actually put it.
    expect(event).toMatchObject({ task: { id: "t1", column: "DONE", position: 0 } });
  });

  it("carries the project a task was moved under, so delivery can be filtered", async () => {
    const { useCases, published } = fixture({ tasks: [task({ id: "t1", projectId: "p1" })] });
    await useCases.update(admin, "t1", { title: "Renamed" });
    expect(published[0]).toMatchObject({ orgId: "org1", projectId: "p1" });
  });
});
