import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { TaskDependencies, TaskRecord } from "./ports.js";

export interface RemovedTaskFile {
  readonly entityType: "task-image" | "task-document";
  readonly entityId: string;
  readonly summary: string;
  readonly name?: string;
}

export async function recordTaskFileRemoval(
  dependencies: Pick<TaskDependencies, "audit" | "projects">,
  transaction: TransactionContext,
  actor: ActorContext,
  task: TaskRecord,
  file: RemovedTaskFile,
): Promise<void> {
  if (task.personal) return;
  const context = task.projectId === null ? null : await dependencies.projects.contextFor(actor, task.projectId);
  await dependencies.audit.append(transaction, {
    action: "DELETE",
    entityType: file.entityType,
    entityId: file.entityId,
    clientId: context?.clientId ?? null,
    projectId: task.projectId,
    leadId: task.leadId,
    summary: file.summary,
    changes: { taskId: task.id, ...(file.name === undefined ? {} : { name: file.name }) },
  }, actor);
}
