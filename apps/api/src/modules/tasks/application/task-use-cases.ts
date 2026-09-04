import { can, isCustomer } from "@adpulse/access-policy";
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
import type {
  TaskChange, TaskDependencies, TaskDescription, TaskFilter, TaskRecord,
} from "./ports.js";
import { taskCreated, taskDeleted, taskMoved, taskUpdated } from "./task-events.js";

export interface CreateTaskInput {
  readonly projectId: string;
  readonly title: string;
  readonly description?: TaskDescription | null;
  readonly column?: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId?: string | null;
  readonly campaignId?: string | null;
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

  const assertCampaignInProject = async (
    campaignId: string | null | undefined,
    projectId: string,
  ) => {
    if (!campaignId) return;
    if (!(await dependencies.campaigns.isInProject(campaignId, projectId))) {
      throw new AppError("validation", "That campaign does not belong to this project");
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
      const context = await projectContext(actor, input.projectId);
      await assertAssignable(actor, input.assigneeId);
      await assertCampaignInProject(input.campaignId, input.projectId);

      const column = input.column ?? DEFAULT_TASK_COLUMN;
      const created = await dependencies.unitOfWork.run(async (transaction) => {
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
          campaignId: input.campaignId ?? null,
          visibleToClient: isCustomer(actor.role),
          position: await dependencies.tasks.countInColumn(actor.orgId, column),
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
      const projectId = input.projectId ?? task.projectId;
      const context = await projectContext(actor, projectId);
      await assertAssignable(actor, input.assigneeId);
      await assertCampaignInProject(input.campaignId, projectId);

      const releasesCampaign = input.campaignId === undefined
        && projectId !== task.projectId
        && task.campaignId !== null;

      const updated = await dependencies.unitOfWork.run(async (transaction) => {
        const changed = await dependencies.tasks.update(transaction, id, {
          ...input,
          ...(input.title === undefined ? {} : { title: input.title.trim() }),
          ...(releasesCampaign ? { campaignId: null } : {}),
        });
        const imageIds = input.description === undefined
          ? changed.imageIds
          : await dependencies.images.claim(
              transaction, id, actor.membershipId, collectImageIds(changed.description),
            );
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "task", entityId: id,
          clientId: context.clientId, projectId: changed.projectId,
          summary: `Updated task “${changed.title}”`,
        }, actor);
        return { ...changed, imageIds };
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
