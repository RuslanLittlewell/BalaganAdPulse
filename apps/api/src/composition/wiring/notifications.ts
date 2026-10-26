import type { ActorContext } from "#shared/application/index.js";
import { config } from "#shared/infrastructure/config.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import type { ProjectKpiEvents } from "#modules/kpi/index.js";
import {
  createDueSoonWorker,
  createNotificationHub,
  createNotificationRouter,
  createNotificationUseCases,
  type NotificationRelay,
} from "#modules/notifications/index.js";
import {
  PrismaDueTasks,
  PrismaKpiMonthClaims,
  PrismaNotificationRecipients,
  PrismaNotificationRepository,
  PrismaProjectKpiStandings,
} from "#modules/notifications/infrastructure/prisma-notifications.js";
import { PrismaMetricRepository } from "#modules/campaigns/infrastructure/prisma-metric-repository.js";
import type { DocumentEvents } from "#modules/project-documents/index.js";
import type { ProjectEvents } from "#modules/projects/index.js";
import type { TaskNotices } from "#modules/tasks/index.js";
import { runDetached, type Kernel } from "./kernel.js";

const NO_RELAY: NotificationRelay = { forward: () => undefined };

export function wireNotifications({ clock }: Kernel, relay: NotificationRelay = NO_RELAY) {
  const hub = createNotificationHub();
  const notifications = createNotificationUseCases({
    notifications: new PrismaNotificationRepository(prisma),
    recipients: new PrismaNotificationRecipients(prisma),
    standings: new PrismaProjectKpiStandings(prisma, new PrismaMetricRepository(prisma)),
    claims: new PrismaKpiMonthClaims(prisma),
    dueTasks: new PrismaDueTasks(prisma),
    hub,
    relay,
    clock,
    timeZone: config.taskTimeZone,
  });
  const projectKpiChanged = (projectId: string, actor: ActorContext | null) =>
    runDetached("Failed to notify of a met KPI:", notifications.projectKpiChanged(projectId, actor));

  const projectEvents: ProjectEvents = {
    created: (project, actor) =>
      runDetached("Failed to notify of a new project:", notifications.projectCreated(project, actor)),
  };
  const taskNotices: TaskNotices = {
    named: (task, memberIds, actor) =>
      runDetached("Failed to notify of a task assignment:", notifications.participantsNamed(task, memberIds, actor)),
    mentioned: (task, memberIds, actor) =>
      runDetached("Failed to notify of a mention:", notifications.taskMentioned(task, memberIds, actor)),
    changed: (task, actor, newcomers) =>
      runDetached("Failed to notify of a task change:", notifications.taskChanged(task, actor, newcomers)),
  };
  const documentEvents: DocumentEvents = {
    created: (document, actor) =>
      runDetached("Failed to notify of a new document:", notifications.documentAdded(document, actor)),
  };
  const kpiEvents: ProjectKpiEvents = {
    changed: (projectId, actor) => projectKpiChanged(projectId, actor),
  };
  const imports = {
    finished: (projectId: string) => projectKpiChanged(projectId, null),
  };

  return {
    notificationRouter: createNotificationRouter(notifications),
    closeNotificationStreams: () => hub.closeAll(),
    dueSoonWorker: createDueSoonWorker({ remind: () => notifications.remindDueTasks() }),
    projectEvents,
    taskNotices,
    documentEvents,
    kpiEvents,
    imports,
  };
}

export type Notifications = ReturnType<typeof wireNotifications>;
