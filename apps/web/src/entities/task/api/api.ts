import { http } from "@/shared/lib/index.js";

/** The six columns, left to right as the board draws them. Mirrors the API's
 * own order — one constant, so a renamed or reordered column cannot be
 * half-changed across the board, the dialog and the filters. */
export const TASK_COLUMNS = [
  "IDEA",
  "IN_PROGRESS",
  "NEEDS_FIX",
  "IN_REVIEW",
  "DONE",
  "ARCHIVED",
] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  projectId: string;
  orgId: string;
  title: string;
  /** A ProseMirror document, or null when the task has no description. */
  description: unknown | null;
  column: TaskColumn;
  priority: TaskPriority;
  assigneeId: string | null;
  createdById: string | null;
  position: number;
  /** The images this task's description claims. Ids only — the board shows
   * that a card has attachments without fetching any of them. */
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
  list: (projectId?: string) =>
    http.get<Task[]>(`/tasks${projectId ? `?projectId=${projectId}` : ""}`),
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
  /**
   * The bytes, fetched with the member's token.
   *
   * The address cannot go straight into an `<img src>`: it needs the bearer
   * token, which the browser will not attach. The editor renders from an
   * object URL made here and revokes it when the node unmounts.
   */
  remove: (id: string) => http.del(`/task-images/${id}`),
  /**
   * The bytes, fetched with the member's credentials.
   *
   * The address cannot go straight into an `<img src>` for the editor's own
   * rendering, which needs the bytes before it draws; the preview renders from
   * an object URL made here and revokes it when it closes.
   */
  blobUrl: async (id: string): Promise<string> => {
    const blob = await http.getBlob(`/task-images/${id}`);
    return URL.createObjectURL(blob);
  },
};
