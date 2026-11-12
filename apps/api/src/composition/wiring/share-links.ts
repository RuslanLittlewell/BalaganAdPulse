import { prisma } from "#shared/infrastructure/prisma.js";
import { createShareLinkRouter, createShareLinkUseCases } from "#modules/share-links/index.js";
import {
  PrismaShareLinkRepository,
  RandomShareTokens,
} from "#modules/share-links/infrastructure/prisma-share-link-repository.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { ModuleEntitlements } from "#modules/share-links/index.js";
import type { Kernel } from "./kernel.js";

export function wireShareLinks(
  { unitOfWork, audit, ids }: Kernel,
  { projectRepository, projects }: Pick<ClientsAndProjects, "projectRepository" | "projects">,
  entitlements: ModuleEntitlements,
) {
  const shareLinks = createShareLinkUseCases({
    links: new PrismaShareLinkRepository(prisma, unitOfWork),
    projects: projectRepository,
    projectView: projects,
    entitlements,
    tokens: new RandomShareTokens(),
    ids,
    audit,
    unitOfWork,
  });
  return { shareLinks, shareLinkRouter: createShareLinkRouter(shareLinks) };
}
