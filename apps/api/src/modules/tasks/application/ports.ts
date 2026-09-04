import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { TaskEventPublisher } from "./task-events.js";
import type { TaskColumn, TaskPriority } from "../domain/board.js";

/** A ProseMirror document. Opaque here: the domain does not interpret it, and
 * the schema the editor validates against is what keeps it inert. */
export type TaskDescription = unknown;

export interface TaskRecord {
  readonly id: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly title: string;
  readonly description: TaskDescription | null;
  readonly column: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly createdById: string | null;
  /** The campaign this work is about. Null is a statement, not a gap: the task
   * is about the project as a whole. */
  readonly campaignId: string | null;
  /** Whether the customer is shown this task. False for the agency's own work,
   * which is what a task is unless a client raised it or an admin shared it. */
  readonly visibleToClient: boolean;
  readonly position: number;
  /** The images this task's description claims, so the board can show that a
   * card has attachments without fetching any of them. */
  readonly imageIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTask {
  readonly id: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly title: string;
  readonly description?: TaskDescription | null;
  readonly column: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly createdById: string | null;
  readonly campaignId: string | null;
  readonly visibleToClient: boolean;
  readonly position: number;
}

export interface TaskChange {
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: TaskDescription | null;
  readonly priority?: TaskPriority;
  readonly assigneeId?: string | null;
  readonly campaignId?: string | null;
  readonly visibleToClient?: boolean;
}

/** What narrows a listing. Every field is optional and every one narrows: none
 * of them can widen what the actor's reach already decided. */
export interface TaskFilter {
  readonly projectId?: string;
  readonly campaignId?: string;
}

export interface TaskRepository {
  create(context: TransactionContext, input: NewTask): Promise<TaskRecord>;
  /** Reach is translated here, from the actor's role and grants into a filter. */
  findReachable(actor: ActorContext, id: string): Promise<TaskRecord | null>;
  listReachable(actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]>;
  update(context: TransactionContext, id: string, input: TaskChange): Promise<TaskRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
  countInColumn(orgId: string, column: TaskColumn): Promise<number>;
  /** The ids of one column, in their stored order. */
  columnIds(orgId: string, column: TaskColumn): Promise<string[]>;
  /** Writes a column's order back as a dense 0..n-1 sequence. */
  applyOrder(context: TransactionContext, column: TaskColumn, ids: readonly string[]): Promise<void>;
}

/** Whether the actor may put work under this project, and which client it
 * belongs to — the audit trail records both. */
export interface ProjectReach {
  contextFor(actor: ActorContext, projectId: string): Promise<{ clientId: string } | null>;
}

/**
 * Whether a campaign may be named by a task under this project.
 *
 * Stated as a question rather than a lookup: the tasks module needs to know
 * whether the pairing is allowed, and nothing else about what a campaign is.
 * The campaigns module answers it.
 */
export interface CampaignReach {
  isInProject(campaignId: string, projectId: string): Promise<boolean>;
}

/** Whether a membership may be made responsible for a task: active, and in the
 * same organization as the actor. */
export interface MemberReach {
  isAssignable(actor: ActorContext, membershipId: string): Promise<boolean>;
}

export interface TaskDependencies {
  readonly tasks: TaskRepository;
  readonly images: TaskImageRepository;
  readonly imageStorage: TaskImageStorage;
  readonly projects: ProjectReach;
  readonly campaigns: CampaignReach;
  readonly members: MemberReach;
  readonly audit: AuditWriter;
  readonly events: TaskEventPublisher;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}

export interface TaskImageRecord {
  readonly id: string;
  readonly taskId: string | null;
  readonly uploaderId: string;
  readonly storageKey: string;
  readonly contentType: string;
  readonly bytes: number;
  readonly createdAt: Date;
}

export interface TaskImageRepository {
  create(
    context: TransactionContext,
    input: Omit<TaskImageRecord, "createdAt">,
  ): Promise<TaskImageRecord>;
  findById(id: string): Promise<TaskImageRecord | null>;
  /** The images a task's description currently claims. */
  listForTask(taskId: string): Promise<TaskImageRecord[]>;
  /**
   * Claims unattached images for a task, ignoring any the uploader does not
   * own — a description cannot adopt somebody else's upload.
   *
   * Answers the ids attached to the task afterwards, because the task row was
   * read before this ran and would otherwise report no attachments at all.
   */
  claim(
    context: TransactionContext,
    taskId: string,
    uploaderId: string,
    imageIds: readonly string[],
  ): Promise<string[]>;
  deleteMany(context: TransactionContext, ids: readonly string[]): Promise<void>;
}

export interface TaskImageStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string | undefined }>;
  remove(keys: readonly string[]): Promise<void>;
}
