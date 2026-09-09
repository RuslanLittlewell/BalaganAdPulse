import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { IntegrationDependencies } from "./ports.js";
import { MetaError, publicIntegration } from "../domain/integration.js";
import { nextMorning } from "./schedule.js";

export function createIntegrationUseCases(d: IntegrationDependencies) {
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
    sync: async (actor: ActorContext, id: string) => {
      await reach(actor, id);
      if (!await d.repository.read(id)) throw new AppError("not-found", "Meta integration not found");
      await d.repository.queue(id, d.clock.now());
      return publicIntegration(await d.repository.read(id));
    },
  };
}
