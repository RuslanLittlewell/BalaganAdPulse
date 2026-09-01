import { describe, expect, it } from "vitest";
import {
  taskCreated,
  taskDeleted,
  taskMoved,
  taskUpdated,
} from "../../src/modules/tasks/index.js";
import type { TaskRecord } from "../../src/modules/tasks/index.js";

const task: TaskRecord = {
  id: "t1", projectId: "p1", orgId: "org1", title: "Write the brief", description: null,
  column: "IDEA", priority: "MEDIUM", assigneeId: null, createdById: "m1", position: 0,
  imageIds: [], createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

describe("task events", () => {
  // Both are needed to decide who may receive the event: the organization
  // bounds it, the project is what a grant is held over. A recipient is chosen
  // from the event alone, never by loading the task again.
  it("carries the organization and project on every kind", () => {
    for (const event of [taskCreated(task), taskUpdated(task), taskMoved(task), taskDeleted(task)]) {
      expect(event).toMatchObject({ orgId: "org1", projectId: "p1" });
    }
  });

  it("carries the stored task on create, update and move", () => {
    for (const event of [taskCreated(task), taskUpdated(task), taskMoved(task)]) {
      expect(event).toMatchObject({ task });
    }
  });

  it("names the four kinds distinctly", () => {
    expect([taskCreated(task), taskUpdated(task), taskMoved(task), taskDeleted(task)]
      .map((event) => event.kind))
      .toEqual(["task.created", "task.updated", "task.moved", "task.deleted"]);
  });

  // A deleted task has no row left to send, and a recipient that never saw it
  // needs only enough to drop it from a board it may be holding.
  it("carries only the identifier on delete", () => {
    const event = taskDeleted(task);
    expect(event).toEqual({
      kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "t1",
    });
    expect(event).not.toHaveProperty("task");
  });
});
