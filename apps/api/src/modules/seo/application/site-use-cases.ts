import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { publicSite, SeoProviderError, siteLabel } from "../domain/seo-site.js";
import type { SearchConsole, SeoDependencies } from "./ports.js";

const SIGN_IN_MS = 10 * 60_000;

export async function explained<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SeoProviderError) throw new AppError("validation", error.message, [{ code: error.code }]);
    throw error;
  }
}

export async function readableProject(d: Pick<SeoDependencies, "projects">, actor: ActorContext, projectId: string) {
  const project = await d.projects.findReachable(actor, projectId);
  if (!project) throw new AppError("not-found", "Project not found");
  return project;
}

export async function readableSite(d: Pick<SeoDependencies, "projects" | "sites">, actor: ActorContext, projectId: string, siteId: string) {
  await readableProject(d, actor, projectId);
  const site = await d.sites.read(projectId, siteId);
  if (!site) throw new AppError("not-found", "Site not found");
  return site;
}

export function createSiteUseCases(d: SeoDependencies) {
  const configured = (): SearchConsole => {
    if (!d.console) throw new AppError("validation", "SEO integration: CONFIGURATION", [{ code: "CONFIGURATION" }]);
    return d.console;
  };

  const managedProject = async (actor: ActorContext, projectId: string) => {
    const project = await readableProject(d, actor, projectId);
    if (!can(actor, "update", "integration")) throw new AppError("forbidden", "Your role may not manage integrations");
    return project;
  };

  const managedSite = async (actor: ActorContext, projectId: string, siteId: string) => {
    const project = await managedProject(actor, projectId);
    const site = await d.sites.read(projectId, siteId);
    if (!site) throw new AppError("not-found", "Site not found");
    return { project, site };
  };

  const ownedSignIn = async (actor: ActorContext, projectId: string, id: string) => {
    const found = await d.signIns.read(id, d.clock.now());
    if (!found || found.purpose !== "SEARCH_CONSOLE" || found.projectId !== projectId || found.userId !== actor.userId || found.encryptedRefreshToken === null) {
      throw new AppError("not-found", "Google sign-in not found");
    }
    return { ...found, encryptedRefreshToken: found.encryptedRefreshToken };
  };

  const reachedSites = async (searchConsole: SearchConsole, refreshToken: string) =>
    explained(async () => searchConsole.sites(await searchConsole.accessToken(refreshToken)));

  const audited = (actor: ActorContext, project: { id: string; clientId: string }, summary: string) =>
    (context: Parameters<SeoDependencies["audit"]["append"]>[0]) =>
      d.audit.append(context, {
        action: "UPDATE",
        entityType: "project",
        entityId: project.id,
        projectId: project.id,
        clientId: project.clientId,
        summary,
      }, actor);

  return {
    start: async (actor: ActorContext, projectId: string, siteId: string | null): Promise<{ url: string }> => {
      if (siteId) await managedSite(actor, projectId, siteId);
      else await managedProject(actor, projectId);
      const searchConsole = configured();
      const now = d.clock.now();
      const opened = await d.signIns.open(
        { projectId, userId: actor.userId, integrationId: siteId, purpose: "SEARCH_CONSOLE" },
        now,
        new Date(now.getTime() + SIGN_IN_MS),
      );
      return { url: searchConsole.consentUrl(opened.id) };
    },

    choices: async (actor: ActorContext, projectId: string, authorization: string) => {
      await managedProject(actor, projectId);
      const searchConsole = configured();
      const signIn = await ownedSignIn(actor, projectId, authorization);
      if (signIn.integrationId) return { renewing: true, sites: [] };
      const reached = await reachedSites(searchConsole, d.cipher.decrypt(signIn.encryptedRefreshToken, projectId));
      const taken = new Set((await d.sites.list(projectId)).map((site) => site.siteUrl));
      return {
        renewing: false,
        sites: reached
          .filter((choice) => !taken.has(choice.siteUrl))
          .map((choice) => ({ siteUrl: choice.siteUrl, label: siteLabel(choice.siteUrl), permissionLevel: choice.permissionLevel })),
      };
    },

    connect: async (actor: ActorContext, projectId: string, input: { authorization: string; siteUrl?: string }) => {
      const project = await managedProject(actor, projectId);
      const searchConsole = configured();
      const signIn = await ownedSignIn(actor, projectId, input.authorization);
      const existing = signIn.integrationId ? await d.sites.read(projectId, signIn.integrationId) : null;
      if (signIn.integrationId && !existing) throw new AppError("not-found", "Site not found");
      const siteUrl = existing?.siteUrl ?? input.siteUrl;
      if (!siteUrl) throw new AppError("validation", "siteUrl is required");
      const reached = await reachedSites(searchConsole, d.cipher.decrypt(signIn.encryptedRefreshToken, projectId));
      if (!reached.some((choice) => choice.siteUrl === siteUrl)) {
        throw new AppError("validation", "The Google sign-in does not reach this site", [{ code: "SITE" }]);
      }
      if (!existing && (await d.sites.list(projectId)).some((site) => site.siteUrl === siteUrl)) {
        throw new AppError("conflict", "This site is already connected to the project");
      }
      const label = siteLabel(siteUrl);
      const saved = await d.unitOfWork.run(async (context) => {
        const row = existing
          ? await d.sites.renew(context, existing.id, signIn.encryptedRefreshToken, d.clock.now())
          : await d.sites.add(context, { projectId, siteUrl, encryptedToken: signIn.encryptedRefreshToken }, d.clock.now());
        await audited(actor, project, existing ? `Renewed Search Console sign-in for ${label}` : `Connected Search Console site ${label}`)(context);
        return row;
      });
      await d.signIns.close(signIn.id);
      return { renewed: existing !== null, site: publicSite(saved) };
    },

    list: async (actor: ActorContext, projectId: string) => {
      await readableProject(d, actor, projectId);
      return (await d.sites.list(projectId)).map(publicSite);
    },

    sync: async (actor: ActorContext, projectId: string, siteId: string) => {
      const { site } = await managedSite(actor, projectId, siteId);
      await d.sites.queueImport(site.id, d.clock.now());
      return publicSite((await d.sites.read(projectId, siteId)) ?? site);
    },

    check: async (actor: ActorContext, projectId: string, siteId: string) => {
      const { site } = await managedSite(actor, projectId, siteId);
      await d.sites.queueCheck(site.id, d.clock.now());
      return publicSite((await d.sites.read(projectId, siteId)) ?? site);
    },

    disconnect: async (actor: ActorContext, projectId: string, siteId: string) => {
      const { project, site } = await managedSite(actor, projectId, siteId);
      await d.unitOfWork.run(async (context) => {
        await d.sites.remove(context, site.id);
        await audited(actor, project, `Disconnected Search Console site ${siteLabel(site.siteUrl)}`)(context);
      });
    },
  };
}
