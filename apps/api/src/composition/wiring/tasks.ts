import { prisma } from "#shared/infrastructure/prisma.js";
import { createTaskEventDelivery } from "#modules/realtime/index.js";
import {
  createTaskCommentUseCases,
  createTaskImageRouter,
  createTaskImageUseCases,
  createTaskRouter,
  createTaskUseCases,
  type TaskEvent,
} from "#modules/tasks/index.js";
import { PrismaTaskCommentRepository } from "#modules/tasks/infrastructure/prisma-task-comment-repository.js";
import { PrismaTaskImageRepository, S3TaskImageStorage } from "#modules/tasks/infrastructure/prisma-task-image-repository.js";
import {
  PrismaTaskMemberReach,
  PrismaTaskProjectReach,
  PrismaTaskRepository,
} from "#modules/tasks/infrastructure/prisma-task-repository.js";
import { taskImageUpload } from "#modules/tasks/presentation/http/task-image-upload.js";
import { runDetached, type Kernel } from "./kernel.js";
import type { MembersAndPresence } from "./members-presence.js";
import type { Notifications } from "./notifications.js";

export function wireTasks(
  { unitOfWork, ids, audit, connections }: Kernel,
  { members }: Pick<MembersAndPresence, "members">,
  { taskNotices }: Pick<Notifications, "taskNotices">,
) {
  const projects = new PrismaTaskProjectReach(prisma);
  const delivery = createTaskEventDelivery({ registry: connections, members, projects });
  const dependencies = {
    tasks: new PrismaTaskRepository(prisma, unitOfWork),
    images: new PrismaTaskImageRepository(prisma, unitOfWork),
    imageStorage: new S3TaskImageStorage(),
    projects,
    members: new PrismaTaskMemberReach(prisma),
    audit,
    events: {
      publish: (event: TaskEvent) => runDetached("Failed to deliver task event:", delivery.deliver(event)),
    },
    notices: taskNotices,
    ids,
    unitOfWork,
  };
  const taskUseCases = createTaskUseCases(dependencies);
  return {
    taskUseCases,
    taskRouter: createTaskRouter(taskUseCases, createTaskCommentUseCases({
      tasks: dependencies.tasks,
      comments: new PrismaTaskCommentRepository(prisma),
      members: dependencies.members,
      notices: taskNotices,
      ids,
    })),
    taskImageRouter: createTaskImageRouter(createTaskImageUseCases(dependencies), taskImageUpload.single("image")),
  };
}
