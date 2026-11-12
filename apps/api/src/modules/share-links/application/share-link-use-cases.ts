import { can, enabledModules, type Action, type ModuleKey } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, IdGenerator, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import { SHARE_TOKEN, type ShareLink } from "../domain/share-link.js";
import type {
  ModuleEntitlements, ShareLinkRepository, SharedProjectReader, ShareProjectReach, ShareTokenSource,
} from "./ports.js";

export const SHARED_LINK_NOT_FOUND = "Shared link not found";

export interface ShareLinkDependencies {
  readonly links: ShareLinkRepository;
  readonly projects: ShareProjectReach;
  readonly projectView: SharedProjectReader;
  readonly entitlements: ModuleEntitlements;
  readonly tokens: ShareTokenSource;
  readonly ids: IdGenerator;
  readonly audit: AuditWriter;
  readonly unitOfWork: UnitOfWork;
}

export interface SharedProject {
  readonly project: { id: string; name: string };
  readonly modules: ModuleKey[];
}

export interface IssuedShareLink {
  readonly link: ShareLink;
  readonly created: boolean;
}

export function createShareLinkUseCases(d: ShareLinkDependencies) {
  const projectFor = async (actor: ActorContext, projectId: string, action: Action) => {
    const project = await d.projects.findReachable(actor, projectId);
    if (!project) throw new AppError("not-found", "Project not found");
    if (!can(actor, action, "share-link")) {
      throw new AppError("forbidden", "Your role may not manage a project's share link");
    }
    return project;
  };

  return {
    async read(actor: ActorContext, projectId: string): Promise<ShareLink | null> {
      const project = await projectFor(actor, projectId, "read");
      return d.links.find(project.id);
    },

    async issue(actor: ActorContext, projectId: string, renew: boolean): Promise<IssuedShareLink> {
      const project = await projectFor(actor, projectId, renew ? "update" : "create");
      return d.unitOfWork.run(async (context) => {
        const existing = await d.links.find(project.id, context);
        if (existing && !renew) return { link: existing, created: false };
        const token = d.tokens.issue();
        const link = existing
          ? await d.links.renew(context, project.id, token)
          : await d.links.create(context, { id: d.ids.generate(), projectId: project.id, token, createdById: actor.membershipId });
        await d.audit.append(context, {
          action: "UPDATE", entityType: "project", entityId: project.id,
          clientId: project.clientId, projectId: project.id,
          summary: existing
            ? `Replaced the share link of project “${project.name}”`
            : `Created a share link for project “${project.name}”`,
          changes: { shareLink: existing ? "replaced" : "created" },
        }, actor);
        return { link, created: existing === null };
      });
    },

    async remove(actor: ActorContext, projectId: string): Promise<void> {
      const project = await projectFor(actor, projectId, "delete");
      await d.unitOfWork.run(async (context) => {
        if (!(await d.links.find(project.id, context))) throw new AppError("not-found", "Share link not found");
        await d.links.remove(context, project.id);
        await d.audit.append(context, {
          action: "UPDATE", entityType: "project", entityId: project.id,
          clientId: project.clientId, projectId: project.id,
          summary: `Switched off the share link of project “${project.name}”`,
          changes: { shareLink: "removed" },
        }, actor);
      });
    },

    async open(token: string): Promise<ActorContext> {
      const live = SHARE_TOKEN.test(token) ? await d.links.findLive(token) : null;
      if (!live) throw new AppError("not-found", SHARED_LINK_NOT_FOUND);
      return { userId: "", membershipId: "", orgId: live.orgId, role: "GUEST", sharedProjectId: live.projectId };
    },

    async describe(actor: ActorContext): Promise<SharedProject> {
      if (actor.sharedProjectId === undefined) throw new AppError("not-found", SHARED_LINK_NOT_FOUND);
      const [project, keepsLeads] = await Promise.all([
        d.projectView.read(actor, actor.sharedProjectId),
        d.entitlements.isEntitled(actor, "CRM"),
      ]);
      return { project, modules: enabledModules(keepsLeads ? ["CRM"] : []) };
    },
  };
}

export type ShareLinkUseCases = ReturnType<typeof createShareLinkUseCases>;
