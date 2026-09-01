import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";

import type { AuditAction, JsonValue } from "../domain/audit-event.js";

export type { AuditAction, JsonValue };

export interface AuditEventInput {
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly clientId?: string | null;
  readonly projectId?: string | null;
  readonly campaignId?: string | null;
  readonly summary: string;
  readonly changes?: JsonValue;
}

export interface AuditWriter {
  append(context: TransactionContext, event: AuditEventInput, actor?: ActorContext): Promise<void>;
}
