import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import { assertUploadableImage } from "../domain/image.js";
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
  };
}

export type TaskImageUseCases = ReturnType<typeof createTaskImageUseCases>;
