import { http } from "@/shared/lib/index.js";
import { localTask, viewerTimeZone } from "../lib/zone.js";

export const TASK_COLUMNS = [
  "IDEA",
  "IN_PROGRESS",
  "NEEDS_FIX",
  "IN_REVIEW",
  "DONE",
  "ARCHIVED",
] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

const TERMINAL_COLUMNS: readonly TaskColumn[] = ["DONE", "ARCHIVED"];

export function isActiveColumn(column: TaskColumn): boolean {
  return !TERMINAL_COLUMNS.includes(column);
}

export const ACTIVE_TASK_COLUMNS: readonly TaskColumn[] = TASK_COLUMNS.filter(isActiveColumn);

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_REPEATS = ["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

export type TaskRepeat = (typeof TASK_REPEATS)[number];

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskDocument {
  id: string;
  name: string;
  bytes: number;
}

export interface TaskLead {
  id: string;
  name: string;
  boardKey: string;
}

export interface Task {
  id: string;
  projectId: string | null;
  leadId?: string | null;
  lead?: TaskLead | null;
  orgId: string;
  title: string;
  description: unknown | null;
  column: TaskColumn;
  priority: TaskPriority;
  createdById: string | null;
  participantIds: string[];
  visibleToClient: boolean;
  personal: boolean;
  position: number;
  dueDate: string | null;
  dueTime: string | null;
  endTime: string | null;
  repeatEvery: TaskRepeat;
  isCall: boolean;
  skipWeekends: boolean;
  timeZone?: string;
  checklist: ChecklistItem[];
  imageIds: string[];
  documents: TaskDocument[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  projectId?: string | null;
  leadId?: string | null;
  title?: string;
  description?: unknown | null;
  column?: TaskColumn;
  priority?: TaskPriority;
  participantIds?: string[];
  visibleToClient?: boolean;
  dueDate?: string | null;
  dueTime?: string | null;
  endTime?: string | null;
  repeatEvery?: TaskRepeat;
  isCall?: boolean;
  skipWeekends?: boolean;
  timeZone?: string;
  checklist?: { title: string; done: boolean }[];
  documentIds?: string[];
}

export interface TaskMove {
  column: TaskColumn;
  position: number;
}

export interface TaskImage {
  id: string;
  taskId: string | null;
  contentType: string;
  bytes: number;
}

function zoned(body: TaskInput): TaskInput {
  const scheduled = body.dueDate !== undefined || body.dueTime !== undefined || body.endTime !== undefined;
  return scheduled ? { ...body, timeZone: viewerTimeZone() } : body;
}

export interface TaskQuery {
  projectId?: string;
  leadId?: string;
  scope?: "crm";
}

export const tasksApi = {
  list: async (filter: TaskQuery = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (filter.projectId) query.set("projectId", filter.projectId);
    if (filter.leadId) query.set("leadId", filter.leadId);
    if (filter.scope) query.set("scope", filter.scope);
    const suffix = query.size === 0 ? "" : `?${query}`;
    return (await http.get<Task[]>(`/tasks${suffix}`, { signal })).map(localTask);
  },
  create: async (body: TaskInput) => localTask(await http.post<Task>("/tasks", zoned(body))),
  update: async (id: string, body: TaskInput) => localTask(await http.patch<Task>(`/tasks/${id}`, zoned(body))),
  remove: (id: string) => http.del(`/tasks/${id}`),
  move: async (id: string, body: TaskMove) => localTask(await http.post<Task>(`/tasks/${id}/move`, body)),
  complete: async (id: string) => localTask(await http.post<Task>(`/tasks/${id}/complete`, {})),
};

export const taskImagesApi = {
  blob: (id: string, signal?: AbortSignal) => http.getBlob(`/task-images/${id}`, { signal }),
  upload: (file: Blob) => {
    const form = new FormData();
    form.append("image", file);
    return http.postForm<TaskImage>("/task-images", form);
  },
  remove: (id: string) => http.del(`/task-images/${id}`),
  blobUrl: async (id: string): Promise<string> => {
    const blob = await http.getBlob(`/task-images/${id}`);
    return URL.createObjectURL(blob);
  },
};

export interface UploadedTaskDocument extends TaskDocument {
  taskId: string | null;
}

export const taskDocumentsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return http.postForm<UploadedTaskDocument>("/task-documents", form);
  },
  remove: (id: string) => http.del(`/task-documents/${id}`),
  pdfUrl: async (id: string): Promise<string> => {
    const blob = await http.getBlob(`/task-documents/${id}`);
    return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  },
};

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  mentionIds: string[];
  createdAt: string;
  editedAt?: string | null;
}

export interface TaskCommentInput {
  body: string;
  mentionIds: string[];
}

export interface TaskParticipant {
  id: string;
  name: string;
  image: string | null;
}

export const taskCommentsApi = {
  list: (taskId: string) => http.get<TaskComment[]>(`/tasks/${taskId}/comments`),
  add: (taskId: string, body: TaskCommentInput) =>
    http.post<TaskComment>(`/tasks/${taskId}/comments`, body),
  edit: (taskId: string, id: string, body: TaskCommentInput) =>
    http.patch<TaskComment>(`/tasks/${taskId}/comments/${id}`, body),
  remove: (taskId: string, id: string) => http.del(`/tasks/${taskId}/comments/${id}`),
  participants: (taskId: string) => http.get<TaskParticipant[]>(`/tasks/${taskId}/participants`),
};
