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
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: "m1",
  campaignId: null, visibleToClient: false, position: 0,
  createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...partial,
});

function fixture(options: {
  tasks?: TaskRecord[];
  reachableProjects?: string[];
  assignable?: string[];
  /** Which campaign belongs to which project, as the campaigns module sees it.
   * A campaign absent from here is either unknown or out of reach — the two are
   * deliberately indistinguishable. */
  campaigns?: Record<string, string>;
  /** Makes the transaction fail after the work has run, so a caller can prove
   * what does and does not survive a rollback. */
  failCommit?: boolean;
} = {}) {
  const context = {} as TransactionContext;
  const tasks = new Map((options.tasks ?? []).map((t) => [t.id, t]));
  const reachableProjects = options.reachableProjects ?? ["p1"];
  const assignable = options.assignable ?? ["m2"];
  const campaigns = options.campaigns ?? { "camp-1": "p1" };
  const audit: Array<Record<string, unknown>> = [];
  const orders: Array<{ column: string; ids: string[] }> = [];
  const claimed: Array<{ taskId: string; imageIds: string[] }> = [];
  const removedObjects: string[] = [];
  const published: TaskEvent[] = [];
  // One ordered log of both, so a test can prove the event follows the commit
  // rather than merely that both happened.
  const journal: string[] = [];

  /** The repository decides this in SQL; the fixture mirrors it, the same way it
   * already mirrors reach, so an application test is not quietly broader than
   * the query it stands in for. */
  const owns = (actor: ActorContext, candidate: TaskRecord) => {
    if (actor.role === "ADMIN") return true;
    if (actor.role === "CLIENT") return candidate.visibleToClient;
    return candidate.assigneeId === actor.membershipId;
  };

  const useCases = createTaskUseCases({
    tasks: {
      create: async (_tx, input) => { const created = task(input); tasks.set(created.id, created); return created; },
      findReachable: async (actor, id) => {
        const found = tasks.get(id);
        return found && reachableProjects.includes(found.projectId) && owns(actor, found)
          ? found
          : null;
      },
      listReachable: async (actor, filter) =>
        [...tasks.values()]
          // Reach first, as the real query does: a filter narrows what the
          // member already reaches and can never widen it.
          .filter((t) => reachableProjects.includes(t.projectId))
          // Then whose work it is, mirroring the repository's own filter.
          .filter((t) => owns(actor, t))
          .filter((t) => !filter?.projectId || t.projectId === filter.projectId)
          .filter((t) => !filter?.campaignId || t.campaignId === filter.campaignId)
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
    campaigns: {
      isInProject: async (campaignId, projectId) => campaigns[campaignId] === projectId,
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
    const { useCases } = fixture({
      tasks: [task({ id: "a" }), task({ id: "b", projectId: "p2" })],
      reachableProjects: ["p1", "p2"],
    });
    expect((await useCases.list(admin, { projectId: "p2" })).map((t) => t.id)).toEqual(["b"]);
  });

  it("lets a guest read the board", async () => {
    const { useCases } = fixture({ tasks: [task({ assigneeId: "m3" })] });
    await expect(useCases.list(guest)).resolves.toHaveLength(1);
  });

  // A customer reads the board now. What they find on it is reach's answer and
  // the visibility rule's — not the matrix's — so an agency task on their own
  // project is simply not there.
  it("lets a client-role member read the board, and shows them nothing of the agency's", async () => {
    const { useCases } = fixture({ tasks: [task()] });

    await expect(useCases.list(customer)).resolves.toEqual([]);
    await expect(useCases.read(customer, "t1")).rejects.toMatchObject({ category: "not-found" });
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
    const { useCases } = fixture({ tasks: [task({ assigneeId: "m3" })] });
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
    const { useCases } = fixture({ tasks: [task({ assigneeId: "m2" })] });
    await expect(useCases.delete(manager, "t1")).resolves.toBeUndefined();
  });

  it("is refused to a guest", async () => {
    const { useCases, tasks } = fixture({ tasks: [task({ assigneeId: "m3" })] });
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
    const { useCases, orders } = fixture({ tasks: [task({ assigneeId: "m3" })] });
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

describe("the campaign a task is about", () => {
  const created = (id = "new-1") => ({ id });

  it("stores the campaign named on creation", async () => {
    const { useCases, tasks } = fixture();

    const task = await useCases.create(admin, {
      projectId: "p1", title: "Переписать объявления", priority: "HIGH", campaignId: "camp-1",
    });

    expect(task.campaignId).toBe("camp-1");
    expect(tasks.get(created().id)?.campaignId).toBe("camp-1");
  });

  // The ordinary case: the work is about the project as a whole.
  it("stores no campaign when none is named", async () => {
    const { useCases } = fixture();

    const task = await useCases.create(admin, {
      projectId: "p1", title: "Согласовать бюджет", priority: "LOW",
    });

    expect(task.campaignId).toBeNull();
  });

  it("refuses a campaign belonging to another project", async () => {
    const { useCases } = fixture({ campaigns: { "camp-2": "p2" } });

    await expect(useCases.create(admin, {
      projectId: "p1", title: "T", priority: "LOW", campaignId: "camp-2",
    })).rejects.toMatchObject({ category: "validation" });
  });

  // A campaign that does not exist and one the caller cannot reach give the
  // same answer, so the refusal never confirms that a campaign exists.
  it("refuses an unknown campaign the same way", async () => {
    const { useCases } = fixture();

    await expect(useCases.create(admin, {
      projectId: "p1", title: "T", priority: "LOW", campaignId: "nowhere",
    })).rejects.toMatchObject({ category: "validation" });
  });

  it("stores nothing when the campaign is refused", async () => {
    const { useCases, tasks } = fixture();

    await useCases.create(admin, {
      projectId: "p1", title: "T", priority: "LOW", campaignId: "nowhere",
    }).catch(() => undefined);

    expect(tasks.size).toBe(0);
  });

  it("attaches a campaign to an existing task", async () => {
    const { useCases } = fixture({ tasks: [task()] });

    const updated = await useCases.update(admin, "t1", { campaignId: "camp-1" });

    expect(updated.campaignId).toBe("camp-1");
  });

  it("releases a campaign when the update names none", async () => {
    const { useCases } = fixture({ tasks: [task({ campaignId: "camp-1" })] });

    const updated = await useCases.update(admin, "t1", { campaignId: null });

    expect(updated.campaignId).toBeNull();
  });

  it("leaves the campaign alone when the update does not mention it", async () => {
    const { useCases } = fixture({ tasks: [task({ campaignId: "camp-1" })] });

    const updated = await useCases.update(admin, "t1", { title: "Другое" });

    expect(updated.campaignId).toBe("camp-1");
  });
});

describe("moving a task to another project", () => {
  const across = { "camp-1": "p1", "camp-2": "p2" };

  // Releasing rather than refusing: an ordinary edit must not fail for a reason
  // the member did not ask about, and the old campaign genuinely is no longer
  // under this task's project.
  it("releases the campaign when only the project changes", async () => {
    const { useCases } = fixture({
      tasks: [task({ campaignId: "camp-1" })],
      reachableProjects: ["p1", "p2"],
      campaigns: across,
    });

    const updated = await useCases.update(admin, "t1", { projectId: "p2" });

    expect(updated.projectId).toBe("p2");
    expect(updated.campaignId).toBeNull();
  });

  it("keeps a campaign named alongside the new project", async () => {
    const { useCases } = fixture({
      tasks: [task({ campaignId: "camp-1" })],
      reachableProjects: ["p1", "p2"],
      campaigns: across,
    });

    const updated = await useCases.update(admin, "t1", { projectId: "p2", campaignId: "camp-2" });

    expect(updated).toMatchObject({ projectId: "p2", campaignId: "camp-2" });
  });

  // A contradiction the member actually wrote, so it is refused rather than
  // quietly resolved.
  it("refuses the old project's campaign alongside the new project", async () => {
    const { useCases, tasks } = fixture({
      tasks: [task({ campaignId: "camp-1" })],
      reachableProjects: ["p1", "p2"],
      campaigns: across,
    });

    await expect(useCases.update(admin, "t1", { projectId: "p2", campaignId: "camp-1" }))
      .rejects.toMatchObject({ category: "validation" });
    expect(tasks.get("t1")).toMatchObject({ projectId: "p1", campaignId: "camp-1" });
  });

  it("keeps the campaign when the project is named but unchanged", async () => {
    const { useCases } = fixture({ tasks: [task({ campaignId: "camp-1" })] });

    const updated = await useCases.update(admin, "t1", { projectId: "p1", title: "Другое" });

    expect(updated.campaignId).toBe("camp-1");
  });
});

describe("listing one campaign's tasks", () => {
  const board = [
    task({ id: "a", campaignId: "camp-1" }),
    task({ id: "b", campaignId: "camp-2" }),
    task({ id: "c", campaignId: null }),
    task({ id: "d", projectId: "p2", campaignId: "camp-1" }),
  ];

  it("returns only the tasks naming that campaign", async () => {
    const { useCases } = fixture({ tasks: board, reachableProjects: ["p1", "p2"] });

    const listed = await useCases.list(admin, { campaignId: "camp-1" });

    expect(listed.map((t) => t.id)).toEqual(["a", "d"]);
  });

  it("narrows by project and campaign together", async () => {
    const { useCases } = fixture({ tasks: board, reachableProjects: ["p1", "p2"] });

    const listed = await useCases.list(admin, { projectId: "p1", campaignId: "camp-1" });

    expect(listed.map((t) => t.id)).toEqual(["a"]);
  });

  // The filter narrows; it never widens. Reach is decided before it applies.
  it("returns nothing for a campaign under a project out of reach", async () => {
    const { useCases } = fixture({ tasks: board, reachableProjects: ["p1"] });

    // "d" names camp-1 but sits under p2, which this member does not reach.
    expect((await useCases.list(admin, { campaignId: "camp-1" })).map((t) => t.id))
      .toEqual(["a"]);
  });

  it("returns everything the member reaches when no campaign is named", async () => {
    const { useCases } = fixture({ tasks: board, reachableProjects: ["p1"] });

    expect((await useCases.list(admin, {})).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("whether a task is shown to the client", () => {
  // The client raised it; it is theirs to see. Not a choice they make.
  it("marks a task raised by a client", async () => {
    const { useCases } = fixture({ reachableProjects: ["p1"] });

    const task = await useCases.create(customer, {
      projectId: "p1", title: "Поменяйте баннер", priority: "MEDIUM",
    });

    expect(task.visibleToClient).toBe(true);
  });

  it("leaves a task raised by the agency as its own", async () => {
    const { useCases } = fixture();

    const byAdmin = await useCases.create(admin, {
      projectId: "p1", title: "Разобрать статистику", priority: "LOW",
    });
    const byManager = await useCases.create(manager, {
      projectId: "p1", title: "Собрать семантику", priority: "LOW",
    });

    expect(byAdmin.visibleToClient).toBe(false);
    expect(byManager.visibleToClient).toBe(false);
  });

  it("lets an admin share a task and take it back", async () => {
    const { useCases } = fixture({ tasks: [task()] });

    expect((await useCases.update(admin, "t1", { visibleToClient: true })).visibleToClient)
      .toBe(true);
    expect((await useCases.update(admin, "t1", { visibleToClient: false })).visibleToClient)
      .toBe(false);
  });

  // Deciding what a customer is shown is one decision, made in one place, by the
  // role that answers for the relationship.
  it("refuses a manager who tries to share one", async () => {
    const { useCases, tasks } = fixture({ tasks: [task({ assigneeId: "m2" })] });

    await expect(useCases.update(manager, "t1", { visibleToClient: true }))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(tasks.get("t1")?.visibleToClient).toBe(false);
  });

  it("refuses a client who tries to hide their own", async () => {
    const { useCases } = fixture({ tasks: [task({ visibleToClient: true, createdById: "m4" })] });

    await expect(useCases.update(customer, "t1", { visibleToClient: false }))
      .rejects.toMatchObject({ category: "forbidden" });
  });

  it("lets a manager edit everything else about a task", async () => {
    const { useCases } = fixture({ tasks: [task({ assigneeId: "m2" })] });

    const updated = await useCases.update(manager, "t1", { title: "Другое", priority: "HIGH" });

    expect(updated).toMatchObject({ title: "Другое", priority: "HIGH" });
  });

  it("leaves the responsible member and the stage alone when sharing", async () => {
    const { useCases } = fixture({
      tasks: [task({ assigneeId: "m2", column: "IN_REVIEW", priority: "HIGH" })],
    });

    const shared = await useCases.update(admin, "t1", { visibleToClient: true });

    expect(shared).toMatchObject({ assigneeId: "m2", column: "IN_REVIEW", priority: "HIGH" });
  });
});
