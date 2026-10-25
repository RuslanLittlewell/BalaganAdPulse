import { http } from "@/shared/lib/index.js";

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

export interface Task {
  id: string;
  projectId: string | null;
  orgId: string;
  title: string;
  description: unknown | null;
  column: TaskColumn;
  priority: TaskPriority;
  createdById: string | null;
  participantIds: string[];
  visibleToClient: boolean;
  position: number;
  dueDate: string | null;
  dueTime: string | null;
  endTime: string | null;
  repeatEvery: TaskRepeat;
  isCall: boolean;
  checklist: ChecklistItem[];
  imageIds: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  projectId?: string | null;
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
  checklist?: { title: string; done: boolean }[];
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

export const tasksApi = {
  list: (projectId?: string) => {
    const query = new URLSearchParams();
    if (projectId) query.set("projectId", projectId);
    const suffix = query.size === 0 ? "" : `?${query}`;
    return http.get<Task[]>(`/tasks${suffix}`);
  },
  create: (body: TaskInput) => http.post<Task>("/tasks", body),
  update: (id: string, body: TaskInput) => http.patch<Task>(`/tasks/${id}`, body),
  remove: (id: string) => http.del(`/tasks/${id}`),
  move: (id: string, body: TaskMove) => http.post<Task>(`/tasks/${id}/move`, body),
  complete: (id: string) => http.post<Task>(`/tasks/${id}/complete`, {}),
};

export const taskImagesApi = {
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

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  mentionIds: string[];
  createdAt: string;
  editedAt?: string | null;
}

export interface TaskCommentInput {
  body: string;
  mentionIds: string[];
}

export const taskCommentsApi = {
  list: (taskId: string) => http.get<TaskComment[]>(`/tasks/${taskId}/comments`),
  add: (taskId: string, body: TaskCommentInput) =>
    http.post<TaskComment>(`/tasks/${taskId}/comments`, body),
  edit: (taskId: string, id: string, body: TaskCommentInput) =>
    http.patch<TaskComment>(`/tasks/${taskId}/comments/${id}`, body),
  remove: (taskId: string, id: string) => http.del(`/tasks/${taskId}/comments/${id}`),
};
