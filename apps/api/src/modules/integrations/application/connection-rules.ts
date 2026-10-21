import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import { ProviderError, type Account } from "../domain/integration.js";
import type { IntegrationDependencies, IntegrationRepository } from "./ports.js";

type Projects = IntegrationDependencies["projects"];

export async function reachableProject(projects: Projects, actor: ActorContext, id: string) {
  const project = await projects.findReachable(actor, id);
  if (!project) throw new AppError("not-found", "Project not found");
  if (!can(actor, "update", "integration")) throw new AppError("forbidden", "Your role may not manage integrations");
  return project;
}

export async function ensureConnectable(
  repository: Pick<IntegrationRepository, "list" | "holdsFigures">,
  project: { id: string; budgetCurrency: string | null },
  account: Account,
  replacing?: string,
): Promise<void> {
  const others = (await repository.list(project.id)).filter((other) => other.id !== replacing);
  if (others.some((other) => other.accountId === account.accountId)) {
    throw new AppError("conflict", "This account is already connected to the project");
  }
  if (others.some((other) => other.currency !== account.currency)) throw new ProviderError("CURRENCY");
  if (account.currency !== project.budgetCurrency && (await repository.holdsFigures(project.id))) {
    throw new ProviderError("CURRENCY");
  }
}

export async function explained<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ProviderError) throw new AppError("validation", error.message, [{ code: error.code }]);
    throw error;
  }
}

export const auditConnection =
  (audit: AuditWriter, actor: ActorContext, project: { id: string; clientId: string }, summary: string) =>
  (context: Parameters<AuditWriter["append"]>[0]) =>
    audit.append(
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
