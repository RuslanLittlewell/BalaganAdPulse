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
  assigneeId: string | null;
  createdById: string | null;
  visibleToClient: boolean;
  position: number;
  dueDate: string | null;
  dueTime: string | null;
  repeatEvery: TaskRepeat;
  checklist: ChecklistItem[];
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  projectId?: string | null;
  title?: string;
  description?: unknown | null;
  column?: TaskColumn;
  priority?: TaskPriority;
  assigneeId?: string | null;
  visibleToClient?: boolean;
  dueDate?: string | null;
  dueTime?: string | null;
  repeatEvery?: TaskRepeat;
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
