import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { AuditEventInput, AuditWriter } from "./audit-writer.js";
import type { AuditDependencies, AuditFilters, AuditPage } from "./ports.js";

/**
 * Appends events through the mutation's own transaction, so the trail and the
 * data it describes commit or roll back together. A log written afterwards
 * records changes that later rolled back and misses changes that succeeded
 * after the logger failed.
 */
export function createAuditWriter(dependencies: AuditDependencies): AuditWriter {
  return {
    async append(
      context: TransactionContext,
      event: AuditEventInput,
      actor?: ActorContext,
    ): Promise<void> {
      if (!actor) throw new Error("Audit actor is unavailable");
      const snapshot = await dependencies.snapshots.forMembership(context, actor.membershipId);
      const request = dependencies.metadata.current();
      await dependencies.events.append(context, {
        orgId: actor.orgId,
        actorId: actor.membershipId,
        actorName: snapshot.name,
        actorEmail: snapshot.email,
        actorRole: actor.role,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        clientId: event.clientId ?? null,
        projectId: event.projectId ?? null,
        campaignId: event.campaignId ?? null,
        summary: event.summary,
        changes: event.changes ?? null,
        requestId: request?.requestId ?? null,
        ip: request?.ip ?? null,
        userAgent: request?.userAgent ?? null,
      });
    },
  };
}

export interface ListAuditInput extends AuditFilters {
  readonly limit: number;
  readonly cursor?: string;
}

/**
 * Reading is scoped like everything else, and by reach rather than by role: a
 * guest sees the history of what they are granted, which is the point of an
 * audit trail they are allowed to consult at all.
 */
export function createAuditReader<TEvent>(dependencies: AuditDependencies<TEvent>) {
  return {
    list: async (actor: ActorContext, input: ListAuditInput): Promise<AuditPage<TEvent>> => {
      const { limit, cursor, ...filters } = input;
      return dependencies.events.list({
        scope: await dependencies.reach.scopeFor(actor),
        filters,
        limit,
        cursor,
      });
    },
  };
}

export type AuditReader<TEvent> = ReturnType<typeof createAuditReader<TEvent>>;
