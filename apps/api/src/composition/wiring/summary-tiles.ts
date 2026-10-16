import { prisma } from "#shared/infrastructure/prisma.js";
import { createSummaryTileRouter, createSummaryTileUseCases } from "#modules/summary-tiles/index.js";
import { PrismaSummaryTileRepository } from "#modules/summary-tiles/infrastructure/prisma-summary-tile-repository.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";

export function wireSummaryTiles(
  { unitOfWork, audit }: Kernel,
  { projectRepository }: Pick<ClientsAndProjects, "projectRepository">,
) {
  const tiles = createSummaryTileUseCases({
    tiles: new PrismaSummaryTileRepository(prisma, unitOfWork),
    projects: projectRepository,
    audit,
    unitOfWork,
  });
  return { summaryTileRouter: createSummaryTileRouter(tiles) };
}
