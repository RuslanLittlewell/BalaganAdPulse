import type { ActorContext } from "#shared/application/index.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import type { ProjectKpiEvents } from "#modules/kpi/index.js";
import {
  createNotificationHub,
  createNotificationRouter,
  createNotificationUseCases,
} from "#modules/notifications/index.js";
import {
  PrismaKpiMonthClaims,
  PrismaNotificationRecipients,
  PrismaNotificationRepository,
  PrismaProjectKpiStandings,
} from "#modules/notifications/infrastructure/prisma-notifications.js";
import type { ProjectEvents } from "#modules/projects/index.js";
import type { TaskAssignments } from "#modules/tasks/index.js";
import { runDetached, type Kernel } from "./kernel.js";

export function wireNotifications({ clock }: Kernel) {
  const hub = createNotificationHub();
  const notifications = createNotificationUseCases({
    notifications: new PrismaNotificationRepository(prisma),
    recipients: new PrismaNotificationRecipients(prisma),
    standings: new PrismaProjectKpiStandings(prisma),
    claims: new PrismaKpiMonthClaims(prisma),
    hub,
    clock,
  });
  const projectKpiChanged = (projectId: string, actor: ActorContext | null) =>
    runDetached("Failed to notify of a met KPI:", notifications.projectKpiChanged(projectId, actor));

  const projectEvents: ProjectEvents = {
    created: (project, actor) =>
      runDetached("Failed to notify of a new project:", notifications.projectCreated(project, actor)),
  };
  const taskAssignments: TaskAssignments = {
    named: (task, memberIds, actor) =>
      runDetached("Failed to notify of a task assignment:", notifications.participantsNamed(task, memberIds, actor)),
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
    projectEvents,
    taskAssignments,
    kpiEvents,
    imports,
  };
}

export type Notifications = ReturnType<typeof wireNotifications>;
