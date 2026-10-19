import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { isKpiGreen, monthToDate } from "#modules/kpi/index.js";
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
}

export function createNotificationUseCases(d: NotificationDependencies) {
  const notify = async (drafts: readonly NewNotification[]) => {
    if (drafts.length === 0) return;
    for (const notification of await d.notifications.createMany(drafts)) d.hub.publish(notification);
  };

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
        recipientId, kind: "PROJECT_CREATED", projectId: project.id, taskId: null, actorId: actor.membershipId,
      })));
    },

    async participantsNamed(task: NamedTask, memberIds: readonly string[], actor: ActorContext): Promise<void> {
      const named = othersThan(memberIds, actor.membershipId);
      if (named.length === 0) return;
      const members = await d.recipients.activeMembers(named);
      const told = members.filter((member) => !member.customer || task.visibleToClient);
      await notify(told.map(({ id }) => ({
        recipientId: id, kind: "TASK_ASSIGNED", projectId: task.projectId, taskId: task.id, actorId: actor.membershipId,
      })));
    },

    async projectKpiChanged(projectId: string, actor: ActorContext | null): Promise<void> {
      const month = monthToDate(d.clock.now());
      const standing = await d.standings.read(projectId, month);
      if (!standing || !isKpiGreen(standing.kpi, standing.figures, month)) return;
      if (!(await d.claims.claim(projectId, month.from))) return;
      const recipients = othersThan(await d.recipients.staffReaching(projectId), actor?.membershipId);
      await notify(recipients.map((recipientId) => ({
        recipientId, kind: "KPI_MET", projectId, taskId: null, actorId: null,
      })));
    },
  };
}

export type NotificationUseCases = ReturnType<typeof createNotificationUseCases>;
