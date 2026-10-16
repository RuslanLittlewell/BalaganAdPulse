import type { TaskRecord } from "./ports.js";

export type TaskEvent =
  | { readonly kind: "task.created"; readonly orgId: string; readonly projectId: string | null; readonly task: TaskRecord }
  | { readonly kind: "task.updated"; readonly orgId: string; readonly projectId: string | null; readonly task: TaskRecord }
  | { readonly kind: "task.moved"; readonly orgId: string; readonly projectId: string | null; readonly task: TaskRecord }
  | {
      readonly kind: "task.deleted";
      readonly orgId: string;
      readonly projectId: string | null;
      readonly taskId: string;
      readonly createdById: string | null;
      readonly participantIds: readonly string[];
      readonly visibleToClient: boolean;
    };

export type TaskEventKind = TaskEvent["kind"];

const carrying = <K extends "task.created" | "task.updated" | "task.moved">(kind: K) =>
  (task: TaskRecord) =>
    ({ kind, orgId: task.orgId, projectId: task.projectId, task }) as const;

export const taskCreated = carrying("task.created");

export const taskUpdated = carrying("task.updated");

export const taskMoved = carrying("task.moved");

export const taskDeleted = (task: TaskRecord): TaskEvent => ({
  kind: "task.deleted",
  orgId: task.orgId,
  projectId: task.projectId,
  taskId: task.id,
  createdById: task.createdById,
  participantIds: task.participantIds,
  visibleToClient: task.visibleToClient,
});

export interface TaskEventPublisher {
  publish(event: TaskEvent): void;
}
