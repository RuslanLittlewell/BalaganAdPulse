import { can, isCustomer } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import {
  DEFAULT_TASK_COLUMN,
  isTaskColumn,
  placeInColumn,
  reorderAfterRemoval,
  type TaskColumn,
  type TaskPriority,
} from "../domain/board.js";
import { collectImageIds } from "../domain/description.js";
import {
  UNSCHEDULED,
  nextOccurrence,
  rescheduled,
  type TaskRepeat,
  type TaskSchedule,
} from "../domain/schedule.js";
import type {
  TaskChange, TaskDependencies, TaskDescription, TaskFilter, TaskRecord,
} from "./ports.js";
import { taskCreated, taskDeleted, taskMoved, taskUpdated } from "./task-events.js";

export interface CreateTaskInput {
  readonly projectId?: string | null;
  readonly title: string;
  readonly description?: TaskDescription | null;
  readonly column?: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId?: string | null;
  readonly dueDate?: string | null;
  readonly dueTime?: string | null;
  readonly repeatEvery?: TaskRepeat;
  readonly checklist?: readonly { title: string; done?: boolean }[];
}

export interface MoveTaskInput {
  readonly column: TaskColumn;
  readonly position: number;
}

export function createTaskUseCases(dependencies: TaskDependencies) {
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

  const reach = async (actor: ActorContext, id: string): Promise<TaskRecord> => {
    assertCanRead(actor);
    const task = await dependencies.tasks.findReachable(actor, id);
    if (!task) throw new AppError("not-found", "Task not found");
    return task;
  };

  const projectContext = async (actor: ActorContext, projectId: string | null) => {
    if (projectId === null) return { clientId: null };
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

  const assertMayShare = (visibleToClient: boolean, projectId: string | null) => {
    if (visibleToClient && projectId === null) {
      throw new AppError("validation", "A task with no project concerns no client");
    }
  };

  const assertMaySetVisibility = (actor: ActorContext, visibleToClient: boolean | undefined) => {
    if (visibleToClient === undefined) return;
    if (actor.role !== "ADMIN") {
      throw new AppError("forbidden", "Only an admin decides what the client is shown");
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

  const assertSchedule = (schedule: TaskSchedule) => {
    if (schedule.dueTime !== null && schedule.dueDate === null) {
      throw new AppError("validation", "A time of day needs a day to fall on");
    }
    if (schedule.repeatEvery !== "NONE" && schedule.dueDate === null) {
      throw new AppError("validation", "A repeating task needs a due date to count from");
    }
  };

  const assertChecklistTitle = (title: string | undefined) => {
    if (title !== undefined && title.trim().length === 0) {
      throw new AppError("validation", "A checklist item needs a title");
    }
  };

  return {
    list: async (actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]> => {
      assertCanRead(actor);
      return dependencies.tasks.listReachable(actor, filter);
    },

    read: (actor: ActorContext, id: string): Promise<TaskRecord> => reach(actor, id),

    create: async (actor: ActorContext, input: CreateTaskInput): Promise<TaskRecord> => {
      assertCanRead(actor);
      assertCan(actor, "create");
      assertTitle(input.title);
      assertColumn(input.column);
      const projectId = input.projectId ?? null;
      const context = await projectContext(actor, projectId);
      await assertAssignable(actor, input.assigneeId);
      assertMayShare(isCustomer(actor.role), projectId);

      const column = input.column ?? DEFAULT_TASK_COLUMN;
      const schedule = rescheduled(UNSCHEDULED, input);
      assertSchedule(schedule);
      for (const item of input.checklist ?? []) assertChecklistTitle(item.title);
      const checklist = (input.checklist ?? []).map((item) => ({
        id: dependencies.ids.generate(), title: item.title.trim(), done: item.done ?? false,
      }));
      const created = await dependencies.unitOfWork.run(async (transaction) => {
        const task = await dependencies.tasks.create(transaction, {
          id: dependencies.ids.generate(),
          projectId,
          orgId: actor.orgId,
          title: input.title.trim(),
          description: input.description ?? null,
          column,
          ...schedule,
          priority: input.priority,
          assigneeId: input.assigneeId ?? null,
          createdById: actor.membershipId,
          visibleToClient: isCustomer(actor.role),
          position: await dependencies.tasks.countInColumn(actor.orgId, column),
          checklist,
        });
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
      dependencies.events.publish(taskCreated(created));
      return created;
    },

    update: async (actor: ActorContext, id: string, input: TaskChange): Promise<TaskRecord> => {
      const task = await reach(actor, id);
      assertCan(actor, "update");
      assertMaySetVisibility(actor, input.visibleToClient);
      assertTitle(input.title);
      const projectId = input.projectId === undefined ? task.projectId : input.projectId;
      const context = await projectContext(actor, projectId);
      await assertAssignable(actor, input.assigneeId);
      assertMayShare(input.visibleToClient ?? task.visibleToClient, projectId);

      const schedule = rescheduled(task, input);
      assertSchedule(schedule);
      for (const item of input.checklist ?? []) assertChecklistTitle(item.title);
      const checklist = input.checklist?.map((item) => ({
        id: dependencies.ids.generate(), title: item.title.trim(), done: item.done ?? false,
      }));

      const updated = await dependencies.unitOfWork.run(async (transaction) => {
        const { checklist: _given, ...fields } = input;
        const changed = await dependencies.tasks.update(transaction, id, {
          ...fields,
          ...schedule,
          ...(input.title === undefined ? {} : { title: input.title.trim() }),
        });
        const withChecklist = checklist === undefined
          ? changed
          : await dependencies.tasks.updateChecklist(transaction, id, checklist);
        const imageIds = input.description === undefined
          ? withChecklist.imageIds
          : await dependencies.images.claim(
              transaction, id, actor.membershipId, collectImageIds(withChecklist.description),
            );
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "task", entityId: id,
          clientId: context.clientId, projectId: withChecklist.projectId,
          summary: `Updated task “${withChecklist.title}”`,
        }, actor);
        return { ...withChecklist, imageIds };
      });
      dependencies.events.publish(taskUpdated(updated));
      return updated;
    },

    delete: async (actor: ActorContext, id: string): Promise<void> => {
      const task = await reach(actor, id);
      assertCan(actor, "delete");
      const context = await projectContext(actor, task.projectId);

      const images = await dependencies.images.listForTask(id);

      await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.tasks.delete(transaction, id);
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

      await dependencies.imageStorage.remove(images.map((image) => image.storageKey));
      dependencies.events.publish(taskDeleted(task));
    },

    complete: async (actor: ActorContext, id: string): Promise<TaskRecord> => {
      const task = await reach(actor, id);
      assertCan(actor, "update");
      if (task.repeatEvery === "NONE" || task.dueDate === null) {
        throw new AppError("validation", "Only a repeating task is completed into its next occurrence");
      }
      const context = await projectContext(actor, task.projectId);
      const dueDate = nextOccurrence(task.dueDate, task.repeatEvery);

      const completed = await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.tasks.untickChecklist(transaction, task.id);
        const moved = await dependencies.tasks.update(transaction, task.id, { dueDate });
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "task", entityId: task.id,
          clientId: context.clientId, projectId: task.projectId,
          summary: `Completed task “${task.title}” of ${task.dueDate}, due next on ${dueDate}`,
        }, actor);
        return moved;
      });
      dependencies.events.publish(taskUpdated(completed));
      return completed;
    },

    move: async (actor: ActorContext, id: string, input: MoveTaskInput): Promise<TaskRecord> => {
      const task = await reach(actor, id);
      assertCan(actor, "update");
      assertColumn(input.column);
      const context = await projectContext(actor, task.projectId);

      const moved = await dependencies.unitOfWork.run(async (transaction) => {
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

        return { ...task, column: input.column, position: target.indexOf(id) };
      });
      dependencies.events.publish(taskMoved(moved));
      return moved;
    },
  };
}

export type TaskUseCases = ReturnType<typeof createTaskUseCases>;
