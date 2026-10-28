import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { isKpiGreen, monthToDate } from "#modules/kpi/index.js";
import { addDays, dayIn, deadlineOf, isDueSoon } from "../domain/deadline.js";
import {
  LATEST_NOTIFICATIONS,
  othersThan,
  type NewNotification,
  type NotificationView,
} from "../domain/notification.js";
import type { NotificationSubscriber } from "./notification-hub.js";
import type { NotificationDependencies } from "./ports.js";

export interface NamedTask {
  readonly id: string;
  readonly projectId: string | null;
  readonly visibleToClient: boolean;
  readonly personal: boolean;
}

export interface WatchedTask extends NamedTask {
  readonly participantIds: readonly string[];
}

export function createNotificationUseCases(d: NotificationDependencies) {
  const notify = async (drafts: readonly NewNotification[]) => {
    if (drafts.length === 0) return;
    const created = await d.notifications.createMany(drafts);
    for (const notification of created) d.hub.publish(notification);
    if (created.length > 0) d.relay.forward(created);
  };

  const shownTo = async (memberIds: readonly string[], task: NamedTask) =>
    (await d.recipients.activeMembers(memberIds))
      .filter((member) => !member.customer || task.visibleToClient || task.personal)
      .map(({ id }) => id);

  const aboutTask = (task: NamedTask, kind: NewNotification["kind"], actorId: string | null) =>
    (recipientId: string): NewNotification => ({
      recipientId, kind, projectId: task.projectId, taskId: task.id, documentId: null, actorId,
    });

  return {
    async list(actor: ActorContext): Promise<{ notifications: NotificationView[]; unreadCount: number }> {
      const [notifications, unreadCount] = await Promise.all([
        d.notifications.latest(actor.membershipId, LATEST_NOTIFICATIONS),
        d.notifications.unreadCount(actor.membershipId),
      ]);
      return { notifications, unreadCount };
    },

    async read(actor: ActorContext, id: string): Promise<void> {
      if (!(await d.notifications.markRead(actor.membershipId, id, d.clock.now()))) {
        throw new AppError("not-found", "Notification not found");
      }
    },

    async readAll(actor: ActorContext): Promise<void> {
      await d.notifications.markAllRead(actor.membershipId, d.clock.now());
    },

    subscribe(actor: ActorContext, subscriber: NotificationSubscriber): () => void {
      return d.hub.subscribe(actor.membershipId, subscriber);
    },

    async projectCreated(project: { readonly id: string }, actor: ActorContext): Promise<void> {
      const recipients = othersThan(await d.recipients.staffReaching(project.id), actor.membershipId);
      await notify(recipients.map((recipientId) => ({
        recipientId, kind: "PROJECT_CREATED", projectId: project.id, taskId: null, documentId: null,
        actorId: actor.membershipId,
      })));
    },

    async documentAdded(document: { readonly id: string; readonly projectId: string }, actor: ActorContext): Promise<void> {
      const recipients = othersThan(await d.recipients.staffReaching(document.projectId), actor.membershipId);
      await notify(recipients.map((recipientId) => ({
        recipientId, kind: "DOCUMENT_ADDED", projectId: document.projectId, taskId: null, documentId: document.id,
        actorId: actor.membershipId,
      })));
    },

    async participantsNamed(task: NamedTask, memberIds: readonly string[], actor: ActorContext): Promise<void> {
      const named = othersThan(memberIds, actor.membershipId);
      if (named.length === 0) return;
      await notify((await shownTo(named, task)).map(aboutTask(task, "TASK_ASSIGNED", actor.membershipId)));
    },

    async taskMentioned(task: NamedTask, memberIds: readonly string[], actor: ActorContext): Promise<void> {
      const mentioned = othersThan(memberIds, actor.membershipId);
      if (mentioned.length === 0) return;
      await notify((await shownTo(mentioned, task)).map(aboutTask(task, "TASK_MENTIONED", actor.membershipId)));
    },

    async taskChanged(task: WatchedTask, actor: ActorContext, newcomers: readonly string[]): Promise<void> {
      const watchers = othersThan(task.participantIds.filter((id) => !newcomers.includes(id)), actor.membershipId);
      if (watchers.length === 0) return;
      const at = d.clock.now();
      const fresh: NewNotification[] = [];
      for (const draft of (await shownTo(watchers, task)).map(aboutTask(task, "TASK_UPDATED", actor.membershipId))) {
        const refreshed = await d.notifications.refreshUnread(draft, at);
        if (refreshed) d.hub.publish(refreshed);
        else fresh.push(draft);
      }
      await notify(fresh);
    },

    async projectKpiChanged(projectId: string, actor: ActorContext | null): Promise<void> {
      const month = monthToDate(d.clock.now());
      const standing = await d.standings.read(projectId, month);
      if (standing.length === 0 || !standing.every(({ kpi, figures }) => isKpiGreen(kpi, figures, month))) return;
      if (!(await d.claims.claim(projectId, month.from))) return;
      const recipients = othersThan(await d.recipients.staffReaching(projectId), actor?.membershipId);
      await notify(recipients.map((recipientId) => ({
        recipientId, kind: "KPI_MET", projectId, taskId: null, documentId: null, actorId: null,
      })));
    },

    async remindDueTasks(): Promise<number> {
      const now = d.clock.now();
      const today = dayIn(now, d.timeZone);
      let reminded = 0;
      for (const task of await d.dueTasks.dueBetween(addDays(today, -1), addDays(today, 2))) {
        const deadline = deadlineOf(task.dueDate, task.dueTime, task.timeZone ?? d.timeZone);
        if (!isDueSoon(deadline, now)) continue;
        if (!(await d.dueTasks.claim(task.id, deadline))) continue;
        const named = task.participantIds.length > 0
          ? task.participantIds
          : task.createdById ? [task.createdById] : [];
        await notify((await shownTo(named, task)).map(aboutTask(task, "TASK_DUE_SOON", null)));
        reminded += 1;
      }
      return reminded;
    },
  };
}

export type NotificationUseCases = ReturnType<typeof createNotificationUseCases>;
