import { can, isCustomer } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { MAX_COMMENT_LENGTH, uniqueIds } from "../domain/comment.js";
import type { TaskCommentDependencies, TaskCommentRecord, TaskRecord } from "./ports.js";

export interface AddTaskCommentInput {
  readonly body: string;
  readonly mentionIds?: readonly string[];
}

export function createTaskCommentUseCases(dependencies: TaskCommentDependencies) {
  const reach = async (actor: ActorContext, taskId: string): Promise<TaskRecord> => {
    if (!can(actor, "read", "task")) {
      throw new AppError("forbidden", "Tasks are the agency's internal work");
    }
    const task = await dependencies.tasks.findReachable(actor, taskId);
    if (!task) throw new AppError("not-found", "Task not found");
    return task;
  };

  const textOf = (input: AddTaskCommentInput) => {
    const body = input.body.trim();
    if (body.length === 0) throw new AppError("validation", "A comment needs text");
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new AppError("validation", `A comment holds at most ${MAX_COMMENT_LENGTH} characters`);
    }
    return body;
  };

  const assertMentionable = async (actor: ActorContext, task: TaskRecord, mentionIds: readonly string[]) => {
    if (mentionIds.length === 0) return;
    if (isCustomer(actor.role)) {
      throw new AppError("forbidden", "A customer comments without tagging anyone");
    }
    const members = new Map(
      (await dependencies.members.describe(actor, mentionIds, task.projectId)).map((member) => [member.id, member]),
    );
    for (const id of mentionIds) {
      const member = members.get(id);
      if (!member || !member.active) {
        throw new AppError("validation", "Only an active member of the organization can be tagged");
      }
      if (member.customer && !(task.visibleToClient && member.reachesProject)) {
        throw new AppError("validation", "A client's person is tagged only on a shared task about a project they reach");
      }
    }
  };

  return {
    list: async (actor: ActorContext, taskId: string): Promise<TaskCommentRecord[]> => {
      await reach(actor, taskId);
      return dependencies.comments.list(taskId);
    },

    add: async (actor: ActorContext, taskId: string, input: AddTaskCommentInput): Promise<TaskCommentRecord> => {
      const task = await reach(actor, taskId);
      const body = textOf(input);
      const mentionIds = uniqueIds(input.mentionIds ?? []);
      await assertMentionable(actor, task, mentionIds);

      const comment = await dependencies.comments.create({
        id: dependencies.ids.generate(), taskId, authorId: actor.membershipId, body, mentionIds,
      });
      dependencies.notices.mentioned(task, mentionIds, actor);
      return comment;
    },

    edit: async (actor: ActorContext, taskId: string, commentId: string, input: AddTaskCommentInput): Promise<TaskCommentRecord> => {
      const task = await reach(actor, taskId);
      const comment = await dependencies.comments.find(taskId, commentId);
      if (!comment) throw new AppError("not-found", "Comment not found");
      if (comment.authorId !== actor.membershipId) {
        throw new AppError("forbidden", "Only the author edits a comment");
      }
      const body = textOf(input);
      const mentionIds = uniqueIds(input.mentionIds ?? []);
      await assertMentionable(actor, task, mentionIds);

      const edited = await dependencies.comments.edit(commentId, { body, mentionIds, editedAt: dependencies.clock.now() });
      const tagged = new Set(comment.mentionIds);
      dependencies.notices.mentioned(task, mentionIds.filter((id) => !tagged.has(id)), actor);
      return edited;
    },

    remove: async (actor: ActorContext, taskId: string, commentId: string): Promise<void> => {
      await reach(actor, taskId);
      const comment = await dependencies.comments.find(taskId, commentId);
      if (!comment) throw new AppError("not-found", "Comment not found");
      if (comment.authorId !== actor.membershipId && actor.role !== "ADMIN") {
        throw new AppError("forbidden", "Only the author or an admin deletes a comment");
      }
      await dependencies.comments.delete(commentId);
    },
  };
}

export type TaskCommentUseCases = ReturnType<typeof createTaskCommentUseCases>;
