import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import {
  DEFAULT_TASK_COLUMN,
  isTaskColumn,
  placeInColumn,
  reorderAfterRemoval,
  type TaskColumn,
  type TaskPriority,
} from "../domain/board.js";
import { collectImageIds } from "../domain/description.js";
import type { TaskChange, TaskDependencies, TaskDescription, TaskRecord } from "./ports.js";

export interface CreateTaskInput {
  readonly projectId: string;
  readonly title: string;
  readonly description?: TaskDescription | null;
  readonly column?: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId?: string | null;
}

export interface MoveTaskInput {
  readonly column: TaskColumn;
  readonly position: number;
}

export function createTaskUseCases(dependencies: TaskDependencies) {
  /**
   * Read is a matrix question like any other. A client-role member is refused
   * the board outright rather than shown an empty one — it is the agency's
   * internal work, and the portal change will decide what a customer sees.
   */
  const assertCanRead = (actor: ActorContext) => {
    if (!can(actor, "read", "task")) {
      throw new AppError("forbidden", "Tasks are the agency's internal work");
    }
  };

  const assertCan = (actor: ActorContext, action: "create" | "update" | "delete") => {
    if (!can(actor, action, "task")) {
      throw new AppError("forbidden", `Your role may not ${action} a task`);
    }
  };

  /** Reach first, then the verb: a refusal must never reveal that a task the
   * caller cannot reach exists. */
  const reach = async (actor: ActorContext, id: string): Promise<TaskRecord> => {
    assertCanRead(actor);
    const task = await dependencies.tasks.findReachable(actor, id);
    if (!task) throw new AppError("not-found", "Task not found");
    return task;
  };

  const projectContext = async (actor: ActorContext, projectId: string) => {
    const context = await dependencies.projects.contextFor(actor, projectId);
    if (!context) throw new AppError("not-found", "Project not found");
    return context;
  };

  const assertAssignable = async (actor: ActorContext, assigneeId: string | null | undefined) => {
    if (!assigneeId) return;
    if (!(await dependencies.members.isAssignable(actor, assigneeId))) {
      throw new AppError("validation", "That member cannot be made responsible for this task");
    }
  };

  const assertTitle = (title: string | undefined) => {
    if (title !== undefined && title.trim().length === 0) {
      throw new AppError("validation", "title is required");
    }
  };

  const assertColumn = (column: string | undefined) => {
    if (column !== undefined && !isTaskColumn(column)) {
      throw new AppError("validation", "Unknown column");
    }
  };

  return {
    list: async (actor: ActorContext, projectId?: string): Promise<TaskRecord[]> => {
      assertCanRead(actor);
      return dependencies.tasks.listReachable(actor, projectId);
    },

    read: (actor: ActorContext, id: string): Promise<TaskRecord> => reach(actor, id),

    create: async (actor: ActorContext, input: CreateTaskInput): Promise<TaskRecord> => {
      assertCanRead(actor);
      assertCan(actor, "create");
      assertTitle(input.title);
      assertColumn(input.column);
      const context = await projectContext(actor, input.projectId);
      await assertAssignable(actor, input.assigneeId);

      const column = input.column ?? DEFAULT_TASK_COLUMN;
      return dependencies.unitOfWork.run(async (transaction) => {
        const task = await dependencies.tasks.create(transaction, {
          id: dependencies.ids.generate(),
          projectId: input.projectId,
          orgId: actor.orgId,
          title: input.title.trim(),
          description: input.description ?? null,
          column,
          priority: input.priority,
          assigneeId: input.assigneeId ?? null,
          createdById: actor.membershipId,
          // Appended: a new task joins the end of its column.
          position: await dependencies.tasks.countInColumn(actor.orgId, column),
        });
        // The description points at images uploaded before the task existed;
        // saving is what turns those loose uploads into part of this task.
        const imageIds = await dependencies.images.claim(
          transaction, task.id, actor.membershipId, collectImageIds(task.description),
        );
        await dependencies.audit.append(transaction, {
          action: "CREATE", entityType: "task", entityId: task.id,
          clientId: context.clientId, projectId: task.projectId,
          summary: `Created task “${task.title}”`,
        }, actor);
        return { ...task, imageIds };
      });
    },

    update: async (actor: ActorContext, id: string, input: TaskChange): Promise<TaskRecord> => {
      const task = await reach(actor, id);
      assertCan(actor, "update");
      assertTitle(input.title);
      const context = await projectContext(actor, input.projectId ?? task.projectId);
      await assertAssignable(actor, input.assigneeId);

      return dependencies.unitOfWork.run(async (transaction) => {
        const updated = await dependencies.tasks.update(transaction, id, {
          ...input,
          ...(input.title === undefined ? {} : { title: input.title.trim() }),
        });
        const imageIds = input.description === undefined
          ? updated.imageIds
          : await dependencies.images.claim(
              transaction, id, actor.membershipId, collectImageIds(updated.description),
            );
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "task", entityId: id,
          clientId: context.clientId, projectId: updated.projectId,
          summary: `Updated task “${updated.title}”`,
        }, actor);
        return { ...updated, imageIds };
      });
    },

    delete: async (actor: ActorContext, id: string): Promise<void> => {
      const task = await reach(actor, id);
      assertCan(actor, "delete");
      const context = await projectContext(actor, task.projectId);

      // Read before the delete: the rows go with the task by cascade, and the
      // stored objects have to be named while they are still findable.
      const images = await dependencies.images.listForTask(id);

      await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.tasks.delete(transaction, id);
        // Close the gap the card leaves behind.
        const remaining = reorderAfterRemoval(
          await dependencies.tasks.columnIds(actor.orgId, task.column), id,
        );
        await dependencies.tasks.applyOrder(transaction, task.column, remaining);
        await dependencies.audit.append(transaction, {
          action: "DELETE", entityType: "task", entityId: id,
          clientId: context.clientId, projectId: task.projectId,
          summary: `Deleted task “${task.title}”`,
        }, actor);
      });

      // After the commit: an object removed for a delete that then rolled back
      // would leave a saved task pointing at nothing.
      await dependencies.imageStorage.remove(images.map((image) => image.storageKey));
    },

    /**
     * One drag. Both affected columns are renumbered densely inside a single
     * transaction, so the board can never be observed with a duplicate or a
     * gapped position — only with a card somewhere the loser of a race did not
     * put it, which a reload corrects.
     */
    move: async (actor: ActorContext, id: string, input: MoveTaskInput): Promise<TaskRecord> => {
      const task = await reach(actor, id);
      assertCan(actor, "update");
      assertColumn(input.column);
      const context = await projectContext(actor, task.projectId);

      return dependencies.unitOfWork.run(async (transaction) => {
        if (task.column !== input.column) {
          const source = reorderAfterRemoval(
            await dependencies.tasks.columnIds(actor.orgId, task.column), id,
          );
          await dependencies.tasks.applyOrder(transaction, task.column, source);
        }
        const target = placeInColumn(
          await dependencies.tasks.columnIds(actor.orgId, input.column), id, input.position,
        );
        await dependencies.tasks.applyOrder(transaction, input.column, target);

        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "task", entityId: id,
          clientId: context.clientId, projectId: task.projectId,
          summary: `Moved task “${task.title}” from ${task.column} to ${input.column}`,
        }, actor);

        // Built from what the move just decided rather than read back: the
        // repository's reads run outside this transaction and would still see
        // the card where it started.
        return { ...task, column: input.column, position: target.indexOf(id) };
      });
    },
  };
}

export type TaskUseCases = ReturnType<typeof createTaskUseCases>;
