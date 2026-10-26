import type { AddressedNotification } from "#modules/notifications/index.js";
import type { BotReply } from "#modules/telegram-bot/application/bot-api.js";
import { BOT_COPY } from "./bot-copy.js";
import { dueText, escapeHtml } from "./bot.js";

const COPY = BOT_COPY.notice;

const named = (name: string | undefined) => `«<b>${escapeHtml(name ?? "")}</b>»`;

function headline(notification: AddressedNotification): string {
  const project = named(notification.project?.name);
  const task = named(notification.task?.title);
  switch (notification.kind) {
    case "KPI_MET":
      return `${COPY.kpiMet[0]} ${project} ${COPY.kpiMet[1]}`;
    case "PROJECT_CREATED":
      return `${COPY.projectCreated} ${project}`;
    case "TASK_ASSIGNED":
      return `${COPY.taskAssigned} ${task}`;
    case "TASK_UPDATED":
      return `${COPY.taskUpdated[0]} ${task} ${COPY.taskUpdated[1]}`;
    case "DOCUMENT_ADDED":
      return `${COPY.documentAdded[0]} ${named(notification.document?.title)} ${COPY.documentAdded[1]} ${project}`;
    case "TASK_MENTIONED":
      return `${COPY.taskMentioned} ${task}`;
    case "TASK_DUE_SOON":
      return `${COPY.dueSoon} ${task}`;
  }
}

export function notificationPath(notification: AddressedNotification): string | null {
  if (notification.document && notification.project) {
    return `/projects/${encodeURIComponent(notification.project.id)}/documents/${encodeURIComponent(notification.document.id)}`;
  }
  if (notification.task) return `/tasks?task=${encodeURIComponent(notification.task.id)}`;
  if (notification.project) return `/projects/${encodeURIComponent(notification.project.id)}`;
  return null;
}

export function notificationMessage(notification: AddressedNotification, appUrl: string | null): BotReply {
  const task = notification.task;
  const project = task && notification.project ? `${BOT_COPY.project}: ${escapeHtml(notification.project.name)}` : null;
  const due = notification.kind === "TASK_DUE_SOON" && task ? dueText(task.dueDate, task.dueTime) : null;
  const path = notificationPath(notification);
  return {
    html: [
      headline(notification),
      ...(project ? [project] : []),
      ...(due ? [`${BOT_COPY.due}: ${escapeHtml(due)}`] : []),
      ...(notification.actor ? [`${COPY.from}: ${escapeHtml(notification.actor.name)}`] : []),
      ...(appUrl && path ? ["", `<a href="${escapeHtml(`${appUrl}${path}`)}">${COPY.open}</a>`] : []),
    ].join("\n"),
  };
}
