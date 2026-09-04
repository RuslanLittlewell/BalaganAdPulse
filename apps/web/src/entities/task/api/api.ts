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

export interface Task {
  id: string;
  projectId: string;
  orgId: string;
  title: string;
  description: unknown | null;
  column: TaskColumn;
  priority: TaskPriority;
  assigneeId: string | null;
  createdById: string | null;
  campaignId: string | null;
  visibleToClient: boolean;
  position: number;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  projectId?: string;
  title?: string;
  description?: unknown | null;
  column?: TaskColumn;
  priority?: TaskPriority;
  assigneeId?: string | null;
  campaignId?: string | null;
  visibleToClient?: boolean;
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
  list: (projectId?: string, campaignId?: string) => {
    const query = new URLSearchParams();
    if (projectId) query.set("projectId", projectId);
    if (campaignId) query.set("campaignId", campaignId);
    const suffix = query.size === 0 ? "" : `?${query}`;
    return http.get<Task[]>(`/tasks${suffix}`);
  },
  create: (body: TaskInput) => http.post<Task>("/tasks", body),
  update: (id: string, body: TaskInput) => http.patch<Task>(`/tasks/${id}`, body),
  remove: (id: string) => http.del(`/tasks/${id}`),
  move: (id: string, body: TaskMove) => http.post<Task>(`/tasks/${id}/move`, body),
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
