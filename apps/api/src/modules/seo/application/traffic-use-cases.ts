import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { publicSite, siteLabel } from "../domain/seo-site.js";
import type { Analytics, SeoDependencies } from "./ports.js";
import { explained, readableProject } from "./site-use-cases.js";

const SIGN_IN_MS = 10 * 60_000;

export function createTrafficUseCases(d: SeoDependencies) {
  const configured = (): Analytics => {
    if (!d.analytics) throw new AppError("validation", "SEO integration: CONFIGURATION", [{ code: "CONFIGURATION" }]);
    return d.analytics;
  };

  const managedSite = async (actor: ActorContext, projectId: string, siteId: string) => {
    const project = await readableProject(d, actor, projectId);
    if (!can(actor, "update", "integration")) throw new AppError("forbidden", "Your role may not manage integrations");
    const site = await d.sites.read(projectId, siteId);
    if (!site) throw new AppError("not-found", "Site not found");
    return { project, site };
  };

  const ownedSignIn = async (actor: ActorContext, projectId: string, id: string) => {
    const found = await d.signIns.read(id, d.clock.now());
    if (!found || found.purpose !== "SITE_ANALYTICS" || found.projectId !== projectId || found.userId !== actor.userId || found.encryptedRefreshToken === null) {
      throw new AppError("not-found", "Google sign-in not found");
    }
    return { ...found, encryptedRefreshToken: found.encryptedRefreshToken };
  };

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
    start: async (actor: ActorContext, projectId: string, siteId: string): Promise<{ url: string }> => {
      await managedSite(actor, projectId, siteId);
      const analytics = configured();
      const now = d.clock.now();
      const opened = await d.signIns.open(
        { projectId, userId: actor.userId, integrationId: siteId, purpose: "SITE_ANALYTICS" },
        now,
        new Date(now.getTime() + SIGN_IN_MS),
      );
      return { url: analytics.consentUrl(opened.id) };
    },

    properties: async (actor: ActorContext, projectId: string, authorization: string) => {
      await readableProject(d, actor, projectId);
      if (!can(actor, "update", "integration")) throw new AppError("forbidden", "Your role may not manage integrations");
      const analytics = configured();
      const signIn = await ownedSignIn(actor, projectId, authorization);
      const refreshToken = d.cipher.decrypt(signIn.encryptedRefreshToken, projectId);
      const properties = await explained(async () => analytics.properties(await analytics.accessToken(refreshToken)));
      return { siteId: signIn.integrationId, properties };
    },

    link: async (actor: ActorContext, projectId: string, siteId: string, input: { authorization: string; propertyId: string }) => {
      const { project, site } = await managedSite(actor, projectId, siteId);
      const analytics = configured();
      const signIn = await ownedSignIn(actor, projectId, input.authorization);
      if (signIn.integrationId !== site.id) throw new AppError("not-found", "Google sign-in not found");
      const refreshToken = d.cipher.decrypt(signIn.encryptedRefreshToken, projectId);
      const { property, reachesSite } = await explained(async () => {
        const access = await analytics.accessToken(refreshToken);
        const [properties, sites] = await Promise.all([analytics.properties(access), d.console ? d.console.sites(access) : Promise.resolve(null)]);
        return {
          property: properties.find((choice) => choice.propertyId === input.propertyId) ?? null,
          reachesSite: sites === null || sites.some((choice) => choice.siteUrl === site.siteUrl),
        };
      });
      if (!reachesSite) throw new AppError("validation", "The Google sign-in does not reach this site", [{ code: "SITE" }]);
      if (!property) throw new AppError("validation", "The Google sign-in does not reach this property", [{ code: "PROPERTY" }]);
      const saved = await d.unitOfWork.run(async (context) => {
        const row = await d.sites.linkAnalytics(context, site.id, { encryptedToken: signIn.encryptedRefreshToken, propertyId: property.propertyId, name: property.name }, d.clock.now());
        await audited(actor, project, `Linked Google Analytics property ${property.name} to ${siteLabel(site.siteUrl)}`)(context);
        return row;
      });
      await d.signIns.close(signIn.id);
      return publicSite(saved);
    },

    unlink: async (actor: ActorContext, projectId: string, siteId: string) => {
      const { project, site } = await managedSite(actor, projectId, siteId);
      await d.unitOfWork.run(async (context) => {
        await d.sites.unlinkAnalytics(context, site.id);
        await audited(actor, project, `Unlinked Google Analytics from ${siteLabel(site.siteUrl)}`)(context);
      });
      return publicSite((await d.sites.read(projectId, siteId)) ?? site);
    },
  };
}
