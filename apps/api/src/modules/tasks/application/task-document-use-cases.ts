import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { assertUploadableDocument, safeDocumentName, TASK_DOCUMENT_TYPE } from "../domain/document.js";
import { mayChange } from "./task-authority.js";
import { taskUpdated } from "./task-events.js";
import type { TaskDependencies, TaskDocumentRecord } from "./ports.js";

const NOT_FOUND = "Document not found";

export function createTaskDocumentUseCases(dependencies: TaskDependencies) {
  const assertCanRead = (actor: ActorContext) => {
    if (!can(actor, "read", "task")) {
      throw new AppError("forbidden", "Tasks are the agency's internal work");
    }
  };

  return {
    upload: async (
      actor: ActorContext,
      file: { bytes: Buffer; name: string | undefined },
    ): Promise<TaskDocumentRecord> => {
      assertCanRead(actor);
      if (!can(actor, "create", "task")) {
        throw new AppError("forbidden", "Your role may not create a task");
      }
      assertUploadableDocument(file.bytes);
      const id = dependencies.ids.generate();
      const storageKey = `tasks/documents/${id}`;

      await dependencies.imageStorage.put(storageKey, file.bytes, TASK_DOCUMENT_TYPE);
      return dependencies.unitOfWork.run((transaction) =>
        dependencies.documents.create(transaction, {
          id,
          taskId: null,
          uploaderId: actor.membershipId,
          name: safeDocumentName(file.name),
          storageKey,
          bytes: file.bytes.length,
        }),
      );
    },

    read: async (actor: ActorContext, id: string) => {
      assertCanRead(actor);
      const document = await dependencies.documents.findById(id);
      if (!document) throw new AppError("not-found", NOT_FOUND);

      const entitled = document.taskId === null
        ? document.uploaderId === actor.membershipId
        : (await dependencies.tasks.findReachable(actor, document.taskId)) !== null;
      if (!entitled) throw new AppError("not-found", NOT_FOUND);

      const stored = await dependencies.imageStorage.get(document.storageKey);
      return { body: stored.body, name: document.name };
    },

    remove: async (actor: ActorContext, id: string): Promise<void> => {
      assertCanRead(actor);
      const document = await dependencies.documents.findById(id);
      if (!document) throw new AppError("not-found", NOT_FOUND);

      if (document.taskId === null) {
        if (document.uploaderId !== actor.membershipId) throw new AppError("not-found", NOT_FOUND);
        if (!can(actor, "create", "task")) throw new AppError("not-found", NOT_FOUND);
      }
      const task = document.taskId === null
        ? null
        : await dependencies.tasks.findReachable(actor, document.taskId);
      if (document.taskId !== null && !task) throw new AppError("not-found", NOT_FOUND);
      if (task && !mayChange(actor, task, "update")) throw new AppError("not-found", NOT_FOUND);

      await dependencies.unitOfWork.run((transaction) => dependencies.documents.deleteMany(transaction, [id]));
      await dependencies.imageStorage.remove([document.storageKey]);
      if (task) {
        const documents = (await dependencies.documents.listForTask(task.id))
          .map(({ id: documentId, name, bytes }) => ({ id: documentId, name, bytes }));
        dependencies.events.publish(taskUpdated({ ...task, documents }));
      }
    },
  };
}

export type TaskDocumentUseCases = ReturnType<typeof createTaskDocumentUseCases>;
