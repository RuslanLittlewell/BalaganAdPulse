import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { IntegrationDependencies } from "./ports.js";
import { MetaError, publicIntegration } from "../domain/integration.js";
import type { CreativeView, ImportedCreative, StoredCreative } from "../domain/snapshot.js";
import { nextMorning } from "./schedule.js";

export function createIntegrationUseCases(d: IntegrationDependencies) {
  const creativeLoads = new Map<string, Promise<CreativeView[]>>();

  const reach = async (actor: ActorContext, id: string) => {
    const project = await d.projects.findReachable(actor, id);
    if (!project) throw new AppError("not-found", "Project not found");
    if (!can(actor, "update", "project")) throw new AppError("forbidden", "Your role may not update a project");
    return project;
  };
  return {
    read: async (actor: ActorContext, id: string) => {
      await reach(actor, id);
      return publicIntegration(await d.repository.read(id));
    },
    connect: async (actor: ActorContext, id: string, input: { accountId: string; token: string }) => {
      const project = await reach(actor, id);
      try {
        const encryptedToken = d.cipher.encrypt(input.token, id);
        const account = await d.provider.account(input.accountId, input.token);
        if (account.currency !== project.budgetCurrency) throw new MetaError("CURRENCY");
        return await d.unitOfWork.run(async (context) => {
          const row = await d.repository.save(context, { ...account, projectId: id, encryptedToken, queuedAt: d.clock.now(), nextDailyAt: nextMorning(d.clock.now()) });
          await d.audit.append(context, { action: "UPDATE", entityType: "project", entityId: id, projectId: id, clientId: project.clientId, summary: "Connected Meta advertising account" }, actor);
          return publicIntegration(row);
        });
      } catch (error) {
        if (error instanceof MetaError) throw new AppError("validation", error.message, [{ code: error.code }]);
        throw error;
      }
    },
    disconnect: async (actor: ActorContext, id: string) => {
      const project = await reach(actor, id);
      await d.unitOfWork.run(async (context) => {
        await d.repository.remove(context, id);
        await d.audit.append(context, { action: "UPDATE", entityType: "project", entityId: id, projectId: id, clientId: project.clientId, summary: "Disconnected Meta advertising account" }, actor);
      });
    },
    adCreatives: async (actor: ActorContext, adId: string): Promise<CreativeView[]> => {
      const found = await d.ads.locate(actor, adId);
      if (!found) throw new AppError("not-found", "Ad not found");

      const stored = await d.creatives.list(adId);
      if (stored.length > 0 || found.externalId === null) return stored;

      const active = creativeLoads.get(adId);
      if (active) return active;

      const loading = (async () => {
        const integration = await d.repository.read(found.projectId);
        if (!integration) return stored;

        const token = d.cipher.decrypt(integration.encryptedToken, found.projectId);
        const read = await d.provider.adCreatives(found.externalId!, token, integration.accountId);
        if (read.length === 0) return stored;

        const copied = await Promise.all((read as ImportedCreative[]).map(async ({
          fileUrl, posterUrl, ...creative
        }): Promise<StoredCreative> => {
          const [file, poster] = await Promise.all([
            fileUrl ? d.files.copy(fileUrl, creative.kind) : null,
            posterUrl ? d.files.copy(posterUrl, "IMAGE") : null,
          ]);
          return {
            ...creative,
            fileKey: file?.key, contentType: file?.contentType, bytes: file?.bytes,
            posterKey: poster?.key, posterContentType: poster?.contentType,
          };
        }));
        return d.creatives.save(adId, copied);
      })();
      creativeLoads.set(adId, loading);
      try {
        return await loading;
      } finally {
        if (creativeLoads.get(adId) === loading) creativeLoads.delete(adId);
      }
    },

    adPreview: async (actor: ActorContext, adId: string): Promise<{ url: string }> => {
      const found = await d.ads.locate(actor, adId);
      if (!found?.externalId) throw new AppError("not-found", "Ad not found");
      const integration = await d.repository.read(found.projectId);
      if (!integration) throw new AppError("not-found", "Ad preview not found");
      const token = d.cipher.decrypt(integration.encryptedToken, found.projectId);
      const url = await d.provider.preview(found.externalId, token);
      if (!url) throw new AppError("not-found", "Ad preview not found");
      return { url };
    },

    sync: async (actor: ActorContext, id: string) => {
      await reach(actor, id);
      if (!await d.repository.read(id)) throw new AppError("not-found", "Meta integration not found");
      await d.repository.queue(id, d.clock.now());
      return publicIntegration(await d.repository.read(id));
    },
  };
}
