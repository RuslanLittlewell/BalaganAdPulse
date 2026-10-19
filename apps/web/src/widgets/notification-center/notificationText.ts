import type { Notification } from "@/entities/notification/index.js";
import { t } from "@/shared/config/index.js";
import { formatDay, projectDocumentsPath, projectPath, ROUTES } from "@/shared/lib/index.js";

const quoted = (name: string | undefined) => `«${name ?? ""}»`;

export function notificationText(notification: Notification): string {
  const project = quoted(notification.project?.name);
  const task = quoted(notification.task?.title);
  switch (notification.kind) {
    case "KPI_MET":
      return `${t("notifications.kpiMet.before")} ${project} ${t("notifications.kpiMet.after")}`;
    case "PROJECT_CREATED":
      return `${t("notifications.projectCreated")} ${project}`;
    case "TASK_ASSIGNED":
      return `${t("notifications.taskAssigned")} ${task}`;
    case "TASK_UPDATED":
      return `${t("notifications.taskUpdated.before")} ${task} ${t("notifications.taskUpdated.after")}`;
    case "DOCUMENT_ADDED":
      return `${t("notifications.documentAdded")} ${quoted(notification.document?.title)} ${t("notifications.inProject")} ${project}`;
    case "TASK_DUE_SOON":
      return `${t("notifications.dueSoon")} ${task}`;
  }
}

export function notificationDeadline(notification: Notification): string | null {
  const due = notification.kind === "TASK_DUE_SOON" ? notification.task : null;
  if (!due?.dueDate) return null;
  return `${t("notifications.deadline")} ${formatDay(due.dueDate)}${due.dueTime ? `, ${due.dueTime}` : ""}`;
}

export function notificationTarget(notification: Notification): string | null {
  if (notification.document && notification.project) {
    return projectDocumentsPath(notification.project.id, notification.document.id);
  }
  if (notification.task) return `${ROUTES.tasks}?task=${encodeURIComponent(notification.task.id)}`;
  if (notification.project) return projectPath(notification.project.id);
  return null;
}
