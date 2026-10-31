import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import {
  sameAccount,
  type ChosenTiles,
  type SummaryAccount,
  type SummaryOwner,
  type SummaryTile,
} from "../domain/summary-tiles.js";
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
  const readProject = async (projectId: string): Promise<ChosenTiles> => ({
    tiles: await d.tiles.readProject(projectId),
    accounts: await d.tiles.readAccounts(projectId),
  });
  const accountTiles = async (projectId: string, account: SummaryAccount) =>
    (await d.tiles.readAccounts(projectId)).find((entry) => sameAccount(entry.account, account))?.tiles ?? null;

  return {
    async read(actor: ActorContext, owner: SummaryOwner): Promise<ChosenTiles> {
      if (owner.kind === "dashboard") return { tiles: await d.tiles.readDashboard(actor.membershipId) };
      const project = await projectOf(actor, owner.id);
      return readProject(project.id);
    },

    async choose(
      actor: ActorContext,
      owner: SummaryOwner,
      tiles: readonly SummaryTile[],
      account: SummaryAccount | null = null,
    ): Promise<ChosenTiles> {
      const chosen = [...tiles];
      if (owner.kind === "dashboard") {
        if (account) throw new AppError("validation", "The dashboard's tiles belong to no account");
        await d.unitOfWork.run((context) => d.tiles.writeDashboard(context, actor.membershipId, chosen));
        return { tiles: chosen };
      }
      const project = await projectOf(actor, owner.id);
      if (!can(actor, "update", "project-summary")) {
        throw new AppError("forbidden", "Your role may not choose a project's summary");
      }
      const before = account ? await accountTiles(project.id, account) : await d.tiles.readProject(project.id);
      await d.unitOfWork.run(async (context) => {
        if (account) await d.tiles.writeAccount(context, project.id, account, chosen);
        else await d.tiles.writeProject(context, project.id, chosen);
        await d.audit.append(context, {
          action: "UPDATE", entityType: "project", entityId: project.id,
          clientId: project.clientId, projectId: project.id,
          summary: account
            ? `Changed the summary of project “${project.name}” for ${account.channel} account ${account.accountId}`
            : `Changed the summary of project “${project.name}”`,
          changes: account
            ? { account: { channel: account.channel, accountId: account.accountId }, before, after: chosen }
            : { before, after: chosen },
        }, actor);
      });
      return readProject(project.id);
    },
  };
}

export type SummaryTileUseCases = ReturnType<typeof createSummaryTileUseCases>;
