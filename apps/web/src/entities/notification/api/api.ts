import { http } from "@/shared/lib/index.js";

export const NOTIFICATION_KINDS = [
  "KPI_MET", "PROJECT_CREATED", "TASK_ASSIGNED", "TASK_UPDATED", "DOCUMENT_ADDED", "TASK_DUE_SOON", "TASK_MENTIONED",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface Notification {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
  project: { id: string; name: string } | null;
  task: {
    id: string;
    title: string;
    projectId: string | null;
    dueDate: string | null;
    dueTime: string | null;
  } | null;
  document: { id: string; title: string } | null;
  actor: { name: string } | null;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

export const NOTIFICATION_STREAM_PATH = "/api/notifications/stream";

export const notificationsApi = {
  list: () => http.get<NotificationList>("/notifications"),
  read: (id: string) => http.post<void>(`/notifications/${encodeURIComponent(id)}/read`, {}),
  readAll: () => http.post<void>("/notifications/read-all", {}),
};
