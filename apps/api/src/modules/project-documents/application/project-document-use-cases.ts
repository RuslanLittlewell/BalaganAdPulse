import { can, type Action } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  MAX_TITLE_LENGTH,
  fitsContent,
  isRichText,
  type DocumentChange,
  type DocumentSummary,
  type ProjectDocument,
} from "../domain/project-document.js";
import type { ProjectDocumentDependencies } from "./ports.js";

export function createProjectDocumentUseCases(dependencies: ProjectDocumentDependencies) {
  const projectOf = async (actor: ActorContext, projectId: string, action: Action) => {
    const project = await dependencies.projects.findReachable(actor, projectId);
    if (!project) throw new AppError("not-found", "Project not found");
    if (!can(actor, action, "project-document")) {
      throw new AppError("forbidden", "Project documents are the agency's own");
    }
    return project;
  };

  const documentOf = async (projectId: string, id: string): Promise<ProjectDocument> => {
    const document = await dependencies.documents.find(projectId, id);
    if (!document) throw new AppError("not-found", "Document not found");
    return document;
  };

  const titled = (title: string): string => {
    const trimmed = title.trim();
    if (trimmed.length === 0) throw new AppError("validation", "A document needs a title");
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new AppError("validation", `A title holds at most ${MAX_TITLE_LENGTH} characters`);
    }
    return trimmed;
  };

  const assertContent = (content: unknown) => {
    if (content === undefined || content === null) return;
    if (!isRichText(content)) throw new AppError("validation", "A document's text must be a rich-text document");
    if (!fitsContent(content)) throw new AppError("validation", "A document's text may take at most one megabyte");
  };

  return {
    list: async (actor: ActorContext, projectId: string): Promise<DocumentSummary[]> => {
      const project = await projectOf(actor, projectId, "read");
      return dependencies.documents.list(project.id);
    },

    read: async (actor: ActorContext, projectId: string, id: string): Promise<ProjectDocument> => {
      const project = await projectOf(actor, projectId, "read");
      return documentOf(project.id, id);
    },

    create: async (actor: ActorContext, projectId: string, input: { title: string }): Promise<ProjectDocument> => {
      const project = await projectOf(actor, projectId, "create");
      const title = titled(input.title);
      return dependencies.unitOfWork.run(async (context) => {
        const document = await dependencies.documents.create(context, {
          id: dependencies.ids.generate(), projectId: project.id, title, authorId: actor.membershipId,
        });
        await dependencies.audit.append(context, {
          action: "CREATE", entityType: "project-document", entityId: document.id,
          clientId: project.clientId, projectId: project.id,
          summary: `Created document “${title}”`,
        }, actor);
        return document;
      });
    },

    update: async (actor: ActorContext, projectId: string, id: string, change: DocumentChange): Promise<ProjectDocument> => {
      const project = await projectOf(actor, projectId, "update");
      const before = await documentOf(project.id, id);
      const title = change.title === undefined ? undefined : titled(change.title);
      assertContent(change.content);
      return dependencies.unitOfWork.run(async (context) => {
        const updated = await dependencies.documents.update(context, id, {
          ...(title === undefined ? {} : { title }),
          ...(change.content === undefined ? {} : { content: change.content }),
          editorId: actor.membershipId,
        });
        if (title !== undefined && title !== before.title) {
          await dependencies.audit.append(context, {
            action: "UPDATE", entityType: "project-document", entityId: id,
            clientId: project.clientId, projectId: project.id,
            summary: `Renamed document “${before.title}” to “${title}”`,
            changes: { title: { before: before.title, after: title } },
          }, actor);
        }
        return updated;
      });
    },

    delete: async (actor: ActorContext, projectId: string, id: string): Promise<void> => {
      const project = await projectOf(actor, projectId, "delete");
      const document = await documentOf(project.id, id);
      await dependencies.unitOfWork.run(async (context) => {
        await dependencies.documents.delete(context, id);
        await dependencies.audit.append(context, {
          action: "DELETE", entityType: "project-document", entityId: id,
          clientId: project.clientId, projectId: project.id,
          summary: `Deleted document “${document.title}”`,
        }, actor);
      });
    },
  };
}

export type ProjectDocumentUseCases = ReturnType<typeof createProjectDocumentUseCases>;
