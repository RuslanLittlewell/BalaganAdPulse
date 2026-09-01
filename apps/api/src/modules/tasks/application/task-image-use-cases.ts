import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import { removeImage } from "../domain/description.js";
import { assertUploadableImage } from "../domain/image.js";
import { taskUpdated } from "./task-events.js";
import type { TaskDependencies, TaskImageRecord } from "./ports.js";

/** Every refusal to serve an image answers the same way, whether it is unknown,
 * somebody else's unattached upload, or attached to a task out of reach. */
const NOT_FOUND = "Image not found";

export function createTaskImageUseCases(dependencies: TaskDependencies) {
  const assertCanRead = (actor: ActorContext) => {
    if (!can(actor, "read", "task")) {
      throw new AppError("forbidden", "Tasks are the agency's internal work");
    }
  };

  return {
    /**
     * Stores a pasted or dropped image before the task exists.
     *
     * The row records the uploader and leaves `taskId` null, which is what lets
     * an upload abandoned when the dialog is cancelled be found and reclaimed,
     * and what keeps it private to its uploader until a saved description
     * claims it.
     */
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

      // Written to storage before the row: an object with no row is reclaimable
      // rubbish, whereas a row with no object is a broken image in a saved task.
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

    /**
     * Serves the bytes to somebody entitled to them: the uploader while the
     * image is still unattached, or anybody who can reach the task once it is.
     */
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

    /**
     * Takes an attachment off a task: the row, the stored object, and the
     * reference the description holds.
     *
     * All three, because any one left behind is a defect on its own — a row
     * with no object is a broken attachment, an object with no row is rubbish
     * nobody can reach, and a description still naming the image shows a link
     * that can never open.
     *
     * Reach is checked exactly as reading it is, so an image on a task out of
     * reach is refused the same way an unknown one is.
     */
    remove: async (actor: ActorContext, id: string): Promise<void> => {
      assertCanRead(actor);
      const image = await dependencies.images.findById(id);
      if (!image) throw new AppError("not-found", NOT_FOUND);

      // An unattached upload belongs to whoever made it; an attached one
      // belongs to whoever may change its task. Neither is told which case
      // refused them.
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
        // Identity, not equality: `removeImage` hands back the same value when
        // nothing referenced the image, so an untouched description is not
        // rewritten and no event claims a change that did not happen.
        if (description === task.description) return null;
        const changed = await dependencies.tasks.update(transaction, task.id, { description });
        return { ...changed, imageIds: changed.imageIds.filter((imageId) => imageId !== id) };
      });

      // After the commit, like every other object removal: one deleted for a
      // change that then rolled back would leave a saved task pointing at
      // nothing.
      await dependencies.imageStorage.remove([image.storageKey]);
      if (updated) dependencies.events.publish(taskUpdated(updated));
    },
  };
}

export type TaskImageUseCases = ReturnType<typeof createTaskImageUseCases>;
