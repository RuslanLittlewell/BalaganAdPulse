import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { AuditScope, StoredAuditEvent } from "../domain/audit-event.js";

export interface AuditFilters {
  readonly clientId?: string;
  readonly projectId?: string;
  readonly campaignId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface AuditQuery {
  readonly scope: AuditScope;
  readonly filters: AuditFilters;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AuditPage<TEvent> {
  readonly items: TEvent[];
  readonly nextCursor: string | null;
}

export interface AuditRepository<TEvent = unknown> {
  append(context: TransactionContext, event: StoredAuditEvent): Promise<void>;
  list(query: AuditQuery): Promise<AuditPage<TEvent>>;
}

export interface AuditReach {
  scopeFor(actor: ActorContext): Promise<AuditScope>;
}

export interface RequestMetadata {
  readonly requestId: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface RequestMetadataSource {
  current(): RequestMetadata | undefined;
}

export interface ActorSnapshots {
  forMembership(
    context: TransactionContext,
    membershipId: string,
  ): Promise<{ name: string; email: string }>;
}

export interface AuditDependencies<TEvent = unknown> {
  readonly events: AuditRepository<TEvent>;
  readonly reach: AuditReach;
  readonly metadata: RequestMetadataSource;
  readonly snapshots: ActorSnapshots;
}
