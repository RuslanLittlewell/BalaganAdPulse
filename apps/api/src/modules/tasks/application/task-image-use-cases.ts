import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import { removeImage } from "../domain/description.js";
import { assertUploadableImage } from "../domain/image.js";
import { taskUpdated } from "./task-events.js";
import type { TaskDependencies, TaskImageRecord } from "./ports.js";

const NOT_FOUND = "Image not found";

export function createTaskImageUseCases(dependencies: TaskDependencies) {
  const assertCanRead = (actor: ActorContext) => {
    if (!can(actor, "read", "task")) {
      throw new AppError("forbidden", "Tasks are the agency's internal work");
    }
  };

  return {
    upload: async (
      actor: ActorContext,
      bytes: Buffer,
    ): Promise<TaskImageRecord> => {
      assertCanRead(actor);
      if (!can(actor, "create", "task")) {
        throw new AppError("forbidden", "Your role may not create a task");
      }
      const contentType = assertUploadableImage(bytes);
      const id = dependencies.ids.generate();
      const storageKey = `tasks/images/${id}`;

      await dependencies.imageStorage.put(storageKey, bytes, contentType);
      return dependencies.unitOfWork.run((transaction) =>
        dependencies.images.create(transaction, {
          id,
          taskId: null,
          uploaderId: actor.membershipId,
          storageKey,
          contentType,
          bytes: bytes.length,
        }),
      );
    },

    read: async (actor: ActorContext, id: string) => {
      assertCanRead(actor);
      const image = await dependencies.images.findById(id);
      if (!image) throw new AppError("not-found", NOT_FOUND);

      const entitled = image.taskId === null
        ? image.uploaderId === actor.membershipId
        : (await dependencies.tasks.findReachable(actor, image.taskId)) !== null;
      if (!entitled) throw new AppError("not-found", NOT_FOUND);

      const stored = await dependencies.imageStorage.get(image.storageKey);
      return { body: stored.body, contentType: stored.contentType ?? image.contentType };
    },

    remove: async (actor: ActorContext, id: string): Promise<void> => {
      assertCanRead(actor);
      const image = await dependencies.images.findById(id);
      if (!image) throw new AppError("not-found", NOT_FOUND);

      if (image.taskId === null) {
        if (image.uploaderId !== actor.membershipId) throw new AppError("not-found", NOT_FOUND);
        if (!can(actor, "create", "task")) throw new AppError("not-found", NOT_FOUND);
      }
      const task = image.taskId === null
        ? null
        : await dependencies.tasks.findReachable(actor, image.taskId);
      if (image.taskId !== null && !task) throw new AppError("not-found", NOT_FOUND);
      if (task && !can(actor, "update", "task")) throw new AppError("not-found", NOT_FOUND);

      const updated = await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.images.deleteMany(transaction, [id]);
        if (!task) return null;
        const description = removeImage(task.description, id);
        if (description === task.description) return null;
        const changed = await dependencies.tasks.update(transaction, task.id, { description });
        return { ...changed, imageIds: changed.imageIds.filter((imageId) => imageId !== id) };
      });

      await dependencies.imageStorage.remove([image.storageKey]);
      if (updated) dependencies.events.publish(taskUpdated(updated));
    },
  };
}

export type TaskImageUseCases = ReturnType<typeof createTaskImageUseCases>;
