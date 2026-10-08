import { prisma } from "#shared/infrastructure/prisma.js";
import { createTaskEventDelivery } from "#modules/realtime/index.js";
import {
  createTaskImageRouter,
  createTaskImageUseCases,
  createTaskRouter,
  createTaskUseCases,
  type TaskEvent,
} from "#modules/tasks/index.js";
import { PrismaTaskImageRepository, S3TaskImageStorage } from "#modules/tasks/infrastructure/prisma-task-image-repository.js";
import {
  PrismaTaskMemberReach,
  PrismaTaskProjectReach,
  PrismaTaskRepository,
} from "#modules/tasks/infrastructure/prisma-task-repository.js";
import { taskImageUpload } from "#modules/tasks/presentation/http/task-image-upload.js";
import { runDetached, type Kernel } from "./kernel.js";
import type { MembersAndPresence } from "./members-presence.js";

export function wireTasks(
  { unitOfWork, ids, audit, connections }: Kernel,
  { members }: Pick<MembersAndPresence, "members">,
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
    ids,
    unitOfWork,
  };
  return {
    taskRouter: createTaskRouter(createTaskUseCases(dependencies)),
    taskImageRouter: createTaskImageRouter(createTaskImageUseCases(dependencies), taskImageUpload.single("image")),
  };
}
