import type { TaskRecord } from "./ports.js";

/**
 * What the board tells other members has happened.
 *
 * Every event carries its organization and project, because that pair is what
 * decides who may receive it: the organization bounds the audience, and a
 * project is what a grant is held over. Delivery is chosen from the event
 * alone — never by loading the task again, which would be a read on behalf of
 * a member who may not be entitled to it.
 */
export type TaskEvent =
  | { readonly kind: "task.created"; readonly orgId: string; readonly projectId: string; readonly task: TaskRecord }
  | { readonly kind: "task.updated"; readonly orgId: string; readonly projectId: string; readonly task: TaskRecord }
  | { readonly kind: "task.moved"; readonly orgId: string; readonly projectId: string; readonly task: TaskRecord }
  /** Carries the same ownership facts as the others, so a deletion can be
   * withheld from the same people. Announcing an id to somebody who never held
   * the task would tell them that work they cannot see exists. */
  | {
      readonly kind: "task.deleted";
      readonly orgId: string;
      readonly projectId: string;
      readonly taskId: string;
      readonly assigneeId: string | null;
      readonly visibleToClient: boolean;
    };

export type TaskEventKind = TaskEvent["kind"];

const carrying = <K extends "task.created" | "task.updated" | "task.moved">(kind: K) =>
  (task: TaskRecord) =>
    ({ kind, orgId: task.orgId, projectId: task.projectId, task }) as const;

/** A task that did not exist for the recipient a moment ago. */
export const taskCreated = carrying("task.created");

/** The same card, with changed contents. */
export const taskUpdated = carrying("task.updated");

/**
 * The same card, somewhere else. Separate from an update because a recipient
 * reorders a column for one and redraws a card for the other.
 */
export const taskMoved = carrying("task.moved");

/** Only the identifier: there is no row left to send, and a recipient needs
 * just enough to drop the card from a board it may be holding. */
export const taskDeleted = (task: TaskRecord): TaskEvent => ({
  kind: "task.deleted",
  orgId: task.orgId,
  projectId: task.projectId,
  taskId: task.id,
  assigneeId: task.assigneeId,
  visibleToClient: task.visibleToClient,
});

/**
 * Where a committed task change leaves the module.
 *
 * Deliberately fire-and-forget: publishing must never be able to fail a write
 * that has already committed. What happens to an event after this point —
 * who receives it, and whether anyone does — is the transport's problem.
 */
export interface TaskEventPublisher {
  publish(event: TaskEvent): void;
}
