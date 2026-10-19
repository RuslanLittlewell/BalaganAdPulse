import type { Notification } from "@/entities/notification/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath, ROUTES } from "@/shared/lib/index.js";

const quoted = (name: string | undefined) => `«${name ?? ""}»`;

export function notificationText(notification: Notification): string {
  switch (notification.kind) {
    case "KPI_MET":
      return `${t("notifications.kpiMet.before")} ${quoted(notification.project?.name)} ${t("notifications.kpiMet.after")}`;
    case "PROJECT_CREATED":
      return `${t("notifications.projectCreated")} ${quoted(notification.project?.name)}`;
    case "TASK_ASSIGNED":
      return `${t("notifications.taskAssigned")} ${quoted(notification.task?.title)}`;
  }
}

export function notificationTarget(notification: Notification): string | null {
  if (notification.task) return `${ROUTES.tasks}?task=${encodeURIComponent(notification.task.id)}`;
  if (notification.project) return projectPath(notification.project.id);
  return null;
}
