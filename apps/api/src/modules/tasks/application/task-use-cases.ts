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
  /** Absent or null means the task is about the project as a whole. */
  readonly campaignId?: string | null;
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

  /**
   * The campaign must belong to the project the task will have — not the one it
   * had, and not the one the request happened to mention.
   *
   * An unreachable campaign and an absent one are refused identically: the
   * project is already known to be reachable, so an answer that told them apart
   * would leak what exists outside the caller's grants. It is a 400 rather than
   * a 404 because what failed is a field of the request, not the address.
   */
  const assertCampaignInProject = async (
    campaignId: string | null | undefined,
    projectId: string,
  ) => {
    if (!campaignId) return;
    if (!(await dependencies.campaigns.isInProject(campaignId, projectId))) {
      throw new AppError("validation", "That campaign does not belong to this project");
    }
  };

  /**
   * Deciding what a customer is shown is the agency's to make in one place.
   *
   * A manager may create, edit and complete a task; only an admin says whether
   * the client is shown it. Checked on the field rather than on the verb, so a
   * manager's ordinary edit is unaffected — it is this one change they may not
   * make, not the task.
   */
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
          // A customer raised it, so it is theirs to see — not a choice they
          // make. Anything the agency raises is the agency's own until an admin
          // says otherwise. Asked of the side rather than of the role: a
          // client's principal is a customer like any of its people.
          visibleToClient: isCustomer(actor.role),
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
      // After the commit, never inside it: an event for work that then rolled
      // back would leave every recipient holding a task that never existed.
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

      /**
       * Moving to another project releases a campaign the request did not
       * re-state. The old campaign is not under the new project, and leaving it
       * would store a pairing the model forbids — while refusing the edit would
       * fail it for a reason the member never asked about.
       */
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
      dependencies.events.publish(taskDeleted(task));
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

        // Built from what the move just decided rather than read back: the
        // repository's reads run outside this transaction and would still see
        // the card where it started.
        return { ...task, column: input.column, position: target.indexOf(id) };
      });
      // The same value the caller is handed, so the event and the response
      // cannot disagree about where the card ended up.
      dependencies.events.publish(taskMoved(moved));
      return moved;
    },
  };
}

export type TaskUseCases = ReturnType<typeof createTaskUseCases>;
