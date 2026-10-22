import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { IntegrationDependencies } from "./ports.js";
import { publicIntegration } from "../domain/integration.js";
import type {
  CreativeView,
  ImportedCreative,
  StoredCreative,
} from "../domain/snapshot.js";
import { nextMorning } from "./schedule.js";
import { auditConnection, ensureConnectable, explained, reachableProject } from "./connection-rules.js";

export function createIntegrationUseCases(d: IntegrationDependencies) {
  const creativeLoads = new Map<string, Promise<CreativeView[]>>();

  const reach = (actor: ActorContext, id: string) => reachableProject(d.projects, actor, id);
  const connection = async (
    actor: ActorContext,
    projectId: string,
    id: string,
  ) => {
    const project = await reach(actor, projectId);
    const found = await d.repository.read(projectId, id);
    if (!found) throw new AppError("not-found", "Integration not found");
    return { project, found };
  };

  const verified = async (
    project: { id: string; budgetCurrency: string | null },
    input: { accountId: string; token: string },
    replacing?: string,
  ) => {
    const account = await d.provider.account(input.accountId, input.token);
    await ensureConnectable(d.repository, project, account, replacing);
    return account;
  };

  const connectionData = (
    projectId: string,
    account: Awaited<ReturnType<typeof verified>>,
    encryptedToken: string,
  ) => ({
    ...account,
    projectId,
    encryptedToken,
    queuedAt: d.clock.now(),
    nextDailyAt: nextMorning(d.clock.now()),
  });

  const audited = (
    actor: ActorContext,
    project: { id: string; clientId: string },
    summary: string,
  ) => auditConnection(d.audit, actor, project, summary);

  const integrationOf = async (found: {
    projectId: string;
    accountId: string | null;
  }) => {
    const connections = await d.repository.list(found.projectId);
    if (found.accountId === null)
      return connections.length === 1 ? connections[0] : null;
    return (
      connections.find(
        (candidate) => candidate.accountId === found.accountId,
      ) ?? null
    );
  };

  return {
    list: async (actor: ActorContext, projectId: string) => {
      await reach(actor, projectId);
      return (await d.repository.list(projectId)).map(
        (row) => publicIntegration(row)!,
      );
    },

    connect: async (
      actor: ActorContext,
      projectId: string,
      input: { accountId: string; token: string; leadsEnabled?: boolean },
    ) => {
      const project = await reach(actor, projectId);
      return explained(async () => {
        const encryptedToken = d.cipher.encrypt(input.token, projectId);
        const account = await verified(project, input);
        return d.unitOfWork.run(async (context) => {
          await d.repository.adoptCurrency(
            context,
            projectId,
            account.currency,
          );
          const row = await d.repository.add(
            context,
            {
              ...connectionData(projectId, account, encryptedToken),
              leadsEnabled: input.leadsEnabled ?? false,
            },
            d.clock.now(),
          );
          await audited(
            actor,
            project,
            "Connected Meta advertising account",
          )(context);
          return publicIntegration(row);
        });
      });
    },

    replace: async (
      actor: ActorContext,
      projectId: string,
      id: string,
      input: { accountId: string; token: string },
    ) => {
      const { project, found } = await connection(actor, projectId, id);
      if (found.provider !== "META")
        throw new AppError("validation", "This connection is renewed by signing in again");
      return explained(async () => {
        const encryptedToken = d.cipher.encrypt(input.token, projectId);
        const account = await verified(project, input, id);
        return d.unitOfWork.run(async (context) => {
          await d.repository.adoptCurrency(
            context,
            projectId,
            account.currency,
          );
          const row = await d.repository.replace(
            context,
            id,
            connectionData(projectId, account, encryptedToken),
            d.clock.now(),
          );
          await audited(
            actor,
            project,
            "Replaced Meta advertising account credentials",
          )(context);
          return publicIntegration(row);
        });
      });
    },

    setLeadsEnabled: async (
      actor: ActorContext,
      projectId: string,
      id: string,
      enabled: boolean,
    ) => {
      const { found } = await connection(actor, projectId, id);
      if (found.provider !== "META")
        throw new AppError("validation", "Lead import is available for Meta only");
      await d.repository.setLeadsEnabled(id, enabled, d.clock.now());
      return publicIntegration(await d.repository.read(projectId, id));
    },

    disconnect: async (actor: ActorContext, projectId: string, id: string) => {
      const { project, found } = await connection(actor, projectId, id);
      await d.unitOfWork.run(async (context) => {
        await d.repository.remove(context, id);
        await audited(
          actor,
          project,
          found.provider === "GOOGLE"
            ? "Disconnected Google Ads account"
            : "Disconnected Meta advertising account",
        )(context);
      });
    },

    adCreatives: async (
      actor: ActorContext,
      adId: string,
    ): Promise<CreativeView[]> => {
      const found = await d.ads.locate(actor, adId);
      if (!found) throw new AppError("not-found", "Ad not found");

      const stored = await d.creatives.list(adId);
      if (found.externalId === null) return stored;
      if (stored.length > 0 && !(await d.creatives.outdated(adId)))
        return stored;

      const active = creativeLoads.get(adId);
      if (active) return active;

      const ad = found;
      const refreshed = async () => {
        const integration = await integrationOf(ad);
        if (!integration) return stored;
        const reads = integration.provider === "META" || (integration.provider === "GOOGLE" && d.googleCreatives !== undefined);
        if (!reads) return stored;

        const token = d.cipher.decrypt(
          integration.encryptedToken,
          ad.projectId,
        );
        let read: readonly ImportedCreative[];
        if (integration.provider === "META") {
          read = await d.provider.adCreatives(
            ad.externalId!,
            token,
            integration.accountId,
          );
        } else {
          read = await d.googleCreatives!.adCreatives(
            ad.externalId!,
            { accountId: integration.accountId, loginCustomerId: integration.loginCustomerId },
            token,
          );
        }
        if (read.length === 0) return stored;

        const copied = await Promise.all(
          (read as ImportedCreative[]).map(
            async ({
              fileUrl,
              posterUrl,
              ...creative
            }): Promise<StoredCreative> => {
              const [file, poster] = await Promise.all([
                fileUrl ? d.files.copy(fileUrl, creative.kind) : null,
                posterUrl ? d.files.copy(posterUrl, "IMAGE") : null,
              ]);
              return {
                ...creative,
                fileKey: file?.key,
                contentType: file?.contentType,
                bytes: file?.bytes,
                posterKey: poster?.key,
                posterContentType: poster?.contentType,
              };
            },
          ),
        );
        return d.creatives.save(adId, copied);
      };
      const loading = (async () => {
        try {
          return await refreshed();
        } catch (error) {
          if (stored.length > 0) return stored;
          throw error;
        }
      })();
      creativeLoads.set(adId, loading);
      try {
        return await loading;
      } finally {
        if (creativeLoads.get(adId) === loading) creativeLoads.delete(adId);
      }
    },

    adPreview: async (
      actor: ActorContext,
      adId: string,
    ): Promise<{ url: string }> => {
      const found = await d.ads.locate(actor, adId);
      if (!found?.externalId) throw new AppError("not-found", "Ad not found");
      const integration = await integrationOf(found);
      if (!integration || integration.provider !== "META")
        throw new AppError("not-found", "Ad preview not found");
      const token = d.cipher.decrypt(
        integration.encryptedToken,
        found.projectId,
      );
      const url = await d.provider.preview(found.externalId, token);
      if (!url) throw new AppError("not-found", "Ad preview not found");
      return { url };
    },

    sync: async (actor: ActorContext, projectId: string, id: string) => {
      await connection(actor, projectId, id);
      await d.repository.queue(id, d.clock.now());
      return publicIntegration(await d.repository.read(projectId, id));
    },
  };
}
