import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { IntegrationDependencies } from "./ports.js";
import { MetaError, publicIntegration } from "../domain/integration.js";
import type {
  CreativeView,
  ImportedCreative,
  StoredCreative,
} from "../domain/snapshot.js";
import { nextMorning } from "./schedule.js";

export function createIntegrationUseCases(d: IntegrationDependencies) {
  const creativeLoads = new Map<string, Promise<CreativeView[]>>();

  const reach = async (actor: ActorContext, id: string) => {
    const project = await d.projects.findReachable(actor, id);
    if (!project) throw new AppError("not-found", "Project not found");
    if (!can(actor, "update", "integration"))
      throw new AppError("forbidden", "Your role may not manage integrations");
    return project;
  };
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
    const others = (await d.repository.list(project.id)).filter(
      (other) => other.id !== replacing,
    );
    if (others.some((other) => other.accountId === account.accountId)) {
      throw new AppError(
        "conflict",
        "This account is already connected to the project",
      );
    }
    if (others.some((other) => other.currency !== account.currency))
      throw new MetaError("CURRENCY");
    if (
      account.currency !== project.budgetCurrency &&
      (await d.repository.holdsFigures(project.id))
    ) {
      throw new MetaError("CURRENCY");
    }
    return account;
  };

  const explained = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof MetaError)
        throw new AppError("validation", error.message, [{ code: error.code }]);
      throw error;
    }
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

  const audited =
    (
      actor: ActorContext,
      project: { id: string; clientId: string },
      summary: string,
    ) =>
    (context: Parameters<typeof d.audit.append>[0]) =>
      d.audit.append(
        context,
        {
          action: "UPDATE",
          entityType: "project",
          entityId: project.id,
          projectId: project.id,
          clientId: project.clientId,
          summary,
        },
        actor,
      );

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
              leadsEnabled: input.leadsEnabled ?? true,
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
      const { project } = await connection(actor, projectId, id);
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
      await connection(actor, projectId, id);
      await d.repository.setLeadsEnabled(id, enabled, d.clock.now());
      return publicIntegration(await d.repository.read(projectId, id));
    },

    disconnect: async (actor: ActorContext, projectId: string, id: string) => {
      const { project } = await connection(actor, projectId, id);
      await d.unitOfWork.run(async (context) => {
        await d.repository.remove(context, id);
        await audited(
          actor,
          project,
          "Disconnected Meta advertising account",
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

        const token = d.cipher.decrypt(
          integration.encryptedToken,
          ad.projectId,
        );
        const read = await d.provider.adCreatives(
          ad.externalId!,
          token,
          integration.accountId,
        );
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
      if (!integration) throw new AppError("not-found", "Ad preview not found");
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
