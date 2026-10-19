import { prisma } from "#shared/infrastructure/prisma.js";
import { createProjectDocumentRouter, createProjectDocumentUseCases } from "#modules/project-documents/index.js";
import { PrismaProjectDocumentRepository } from "#modules/project-documents/infrastructure/prisma-project-document-repository.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";
import type { Notifications } from "./notifications.js";

export function wireProjectDocuments(
  { unitOfWork, audit, ids }: Kernel,
  { projectRepository }: Pick<ClientsAndProjects, "projectRepository">,
  { documentEvents }: Pick<Notifications, "documentEvents">,
) {
  const documents = createProjectDocumentUseCases({
    documents: new PrismaProjectDocumentRepository(prisma, unitOfWork),
    projects: projectRepository,
    audit,
    events: documentEvents,
    ids,
    unitOfWork,
  });
  return { projectDocumentRouter: createProjectDocumentRouter(documents) };
}
