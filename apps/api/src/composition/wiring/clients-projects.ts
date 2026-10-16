import type { ActorContext } from "#shared/application/index.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { createClientRouter, createClientUseCases } from "#modules/clients/index.js";
import { S3ClientPictureStorage } from "#modules/clients/infrastructure/client-picture-storage.js";
import { PrismaClientRepository } from "#modules/clients/infrastructure/prisma-client-repository.js";
import { PrismaProjectStaffing } from "#modules/members/index.js";
import { createProjectRouter, createProjectUseCases } from "#modules/projects/index.js";
import { PrismaProjectRepository } from "#modules/projects/infrastructure/prisma-project-repository.js";
import { S3ProjectPictureStorage } from "#modules/projects/infrastructure/project-picture-storage.js";
import {
  createProjectGroupRouter,
  createProjectLayoutRouter,
  createProjectLayoutUseCases,
} from "#modules/project-layout/index.js";
import {
  PrismaLayoutProjectReach,
  PrismaProjectLayoutRepository,
} from "#modules/project-layout/infrastructure/prisma-project-layout-repository.js";
import type { Kernel } from "./kernel.js";

export function wireClientsAndProjects({ unitOfWork, ids, audit }: Kernel) {
  const clientRepository = new PrismaClientRepository(prisma, unitOfWork);
  const projectRepository = new PrismaProjectRepository(prisma, unitOfWork);
  const clients = createClientUseCases({
    clients: clientRepository,
    pictures: new S3ClientPictureStorage(),
    audit,
    ids,
    unitOfWork,
  });
  const clientReach = {
    isReachable: async (actor: ActorContext, clientId: string) =>
      (await clients.reachableIds(actor)).includes(clientId),
  };
  const projects = createProjectUseCases({
    projects: projectRepository,
    clients: clientReach,
    pictures: new S3ProjectPictureStorage(),
    staffing: new PrismaProjectStaffing(prisma, unitOfWork),
    audit,
    ids,
    unitOfWork,
  });
  const projectLayout = createProjectLayoutUseCases({
    layouts: new PrismaProjectLayoutRepository(prisma, unitOfWork),
    projects: new PrismaLayoutProjectReach(prisma),
    ids,
    unitOfWork,
  });
  return {
    clients,
    clientReach,
    clientRepository,
    projectRepository,
    clientRouter: createClientRouter(clients),
    projectRouter: createProjectRouter(projects),
    projectLayoutRouter: createProjectLayoutRouter(projectLayout),
    projectGroupRouter: createProjectGroupRouter(projectLayout),
  };
}

export type ClientsAndProjects = ReturnType<typeof wireClientsAndProjects>;
