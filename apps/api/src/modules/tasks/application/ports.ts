import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "#shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { TaskEventPublisher } from "./task-events.js";
import type { TaskColumn, TaskPriority } from "../domain/board.js";
import type { TaskRepeat } from "../domain/schedule.js";

export type TaskDescription = unknown;

export interface ChecklistItemRecord {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly position: number;
}

export interface TaskRecord {
  readonly id: string;
  readonly projectId: string | null;
  readonly orgId: string;
  readonly title: string;
  readonly description: TaskDescription | null;
  readonly column: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly createdById: string | null;
  readonly visibleToClient: boolean;
  readonly position: number;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly repeatEvery: TaskRepeat;
  readonly checklist: readonly ChecklistItemRecord[];
  readonly imageIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTask {
  readonly id: string;
  readonly projectId: string | null;
  readonly orgId: string;
  readonly title: string;
  readonly description?: TaskDescription | null;
  readonly column: TaskColumn;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly createdById: string | null;
  readonly visibleToClient: boolean;
  readonly position: number;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly repeatEvery: TaskRepeat;
  readonly checklist: readonly { id: string; title: string; done: boolean }[];
}

export interface TaskChange {
  readonly projectId?: string | null;
  readonly title?: string;
  readonly description?: TaskDescription | null;
  readonly priority?: TaskPriority;
  readonly assigneeId?: string | null;
  readonly visibleToClient?: boolean;
  readonly dueDate?: string | null;
  readonly dueTime?: string | null;
  readonly repeatEvery?: TaskRepeat;
  readonly checklist?: readonly { title: string; done?: boolean }[];
}

export interface TaskFilter {
  readonly projectId?: string;
  readonly dueFrom?: string;
  readonly dueTo?: string;
}

export interface TaskRepository {
  create(context: TransactionContext, input: NewTask): Promise<TaskRecord>;
  findReachable(actor: ActorContext, id: string): Promise<TaskRecord | null>;
  listReachable(actor: ActorContext, filter?: TaskFilter): Promise<TaskRecord[]>;
  update(context: TransactionContext, id: string, input: TaskChange): Promise<TaskRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
  countInColumn(orgId: string, column: TaskColumn): Promise<number>;
  columnIds(orgId: string, column: TaskColumn): Promise<string[]>;
  applyOrder(context: TransactionContext, column: TaskColumn, ids: readonly string[]): Promise<void>;
  updateChecklist(
    context: TransactionContext,
    taskId: string,
    items: readonly { id: string; title: string; done: boolean }[],
  ): Promise<TaskRecord>;
  untickChecklist(context: TransactionContext, taskId: string): Promise<void>;
}

export interface ProjectReach {
  contextFor(actor: ActorContext, projectId: string): Promise<{ clientId: string } | null>;
}

export interface MemberReach {
  isAssignable(actor: ActorContext, membershipId: string): Promise<boolean>;
}

export interface TaskDependencies {
  readonly tasks: TaskRepository;
  readonly images: TaskImageRepository;
  readonly imageStorage: TaskImageStorage;
  readonly projects: ProjectReach;
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
  listForTask(taskId: string): Promise<TaskImageRecord[]>;
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
