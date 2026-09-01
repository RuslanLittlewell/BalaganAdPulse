import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { NewProject, ProjectChange, ProjectRecord } from "../domain/project.js";

export interface ProjectRepository {
  create(
    context: TransactionContext,
    input: NewProject & { id: string; position: number },
  ): Promise<ProjectRecord>;
  countForClient(clientId: string): Promise<number>;
  /** Reach is translated here, including the narrowing a project-scoped grant
   * applies. */
  listReachable(actor: ActorContext, clientId?: string): Promise<ProjectRecord[]>;
  findReachable(actor: ActorContext, id: string): Promise<ProjectRecord | null>;
  update(context: TransactionContext, id: string, input: ProjectChange): Promise<ProjectRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
}

/** Whether the actor may put work under this client. Owned here, implemented by
 * the clients module. */
export interface ClientReach {
  isReachable(actor: ActorContext, clientId: string): Promise<boolean>;
}

export interface ProjectPictureStorage {
  read(projectId: string): Promise<Uint8Array | null>;
  write(projectId: string, png: Uint8Array): Promise<void>;
}

export interface ProjectDependencies {
  readonly projects: ProjectRepository;
  readonly clients: ClientReach;
  readonly pictures: ProjectPictureStorage;
  readonly audit: AuditWriter;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
