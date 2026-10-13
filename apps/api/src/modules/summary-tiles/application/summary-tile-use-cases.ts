import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import { inCatalogueOrder, type SummaryOwner, type SummaryTile } from "../domain/summary-tiles.js";
import type { SummaryProjectReach, SummaryTileRepository } from "./ports.js";

export interface SummaryTileDependencies {
  readonly tiles: SummaryTileRepository;
  readonly projects: SummaryProjectReach;
  readonly audit: AuditWriter;
  readonly unitOfWork: UnitOfWork;
}

export function createSummaryTileUseCases(d: SummaryTileDependencies) {
  const projectOf = async (actor: ActorContext, id: string) => {
    const project = await d.projects.findReachable(actor, id);
    if (!project) throw new AppError("not-found", "Project not found");
    return project;
  };

  return {
    async read(actor: ActorContext, owner: SummaryOwner): Promise<SummaryTile[]> {
      if (owner.kind === "dashboard") return d.tiles.readDashboard(actor.membershipId);
      const project = await projectOf(actor, owner.id);
      return d.tiles.readProject(project.id);
    },

    async choose(actor: ActorContext, owner: SummaryOwner, tiles: readonly SummaryTile[]): Promise<SummaryTile[]> {
      const chosen = inCatalogueOrder(tiles);
      if (owner.kind === "dashboard") {
        await d.unitOfWork.run((context) => d.tiles.writeDashboard(context, actor.membershipId, chosen));
        return chosen;
      }
      const project = await projectOf(actor, owner.id);
      if (!can(actor, "update", "project-summary")) {
        throw new AppError("forbidden", "Your role may not choose a project's summary");
      }
      const before = await d.tiles.readProject(project.id);
      await d.unitOfWork.run(async (context) => {
        await d.tiles.writeProject(context, project.id, chosen);
        await d.audit.append(context, {
          action: "UPDATE", entityType: "project", entityId: project.id,
          clientId: project.clientId, projectId: project.id,
          summary: `Changed the summary of project “${project.name}”`,
          changes: { before, after: chosen },
        }, actor);
      });
      return chosen;
    },
  };
}

export type SummaryTileUseCases = ReturnType<typeof createSummaryTileUseCases>;
