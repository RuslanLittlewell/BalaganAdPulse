import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import type { DocumentChange, DocumentSummary, ProjectDocument } from "../domain/project-document.js";

export interface ProjectDocumentRepository {
  list(projectId: string): Promise<DocumentSummary[]>;
  find(projectId: string, id: string): Promise<ProjectDocument | null>;
  create(
    context: TransactionContext,
    input: { id: string; projectId: string; title: string; authorId: string },
  ): Promise<ProjectDocument>;
  update(
    context: TransactionContext,
    id: string,
    change: DocumentChange & { editorId: string },
  ): Promise<ProjectDocument>;
  delete(context: TransactionContext, id: string): Promise<void>;
}

export interface DocumentProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string } | null>;
}

export interface DocumentEvents {
  created(document: ProjectDocument, actor: ActorContext): void;
}

export interface ProjectDocumentDependencies {
  readonly documents: ProjectDocumentRepository;
  readonly projects: DocumentProjectReach;
  readonly audit: AuditWriter;
  readonly events: DocumentEvents;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
