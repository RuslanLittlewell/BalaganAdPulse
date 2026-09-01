import type { Role } from "@adpulse/access-policy";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * An event as it is stored: the actor denormalized into the row.
 *
 * The name, email and role are copied at write time rather than resolved when
 * the trail is read, so removing a member neither erases nor rewrites their
 * history — and a later rename does not silently change what an old event says.
 */
export interface StoredAuditEvent {
  readonly orgId: string;
  readonly actorId: string | null;
  readonly actorName: string;
  readonly actorEmail: string;
  readonly actorRole: Role;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly clientId: string | null;
  readonly projectId: string | null;
  readonly campaignId: string | null;
  readonly summary: string;
  readonly changes: JsonValue | null;
  readonly requestId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/**
 * How much of the trail a member may read. An admin reaches their whole
 * organization; everyone else reaches the history of what their grants name.
 *
 * A project-scoped grant still exposes the client-level history of that client,
 * exactly as it makes the client itself visible: the client record is the
 * parent of the project they were given.
 */
export type AuditScope =
  | { readonly orgId: string; readonly everything: true }
  | {
      readonly orgId: string;
      readonly everything: false;
      readonly clientIds: readonly string[];
      readonly wholeClientIds: readonly string[];
      readonly projectIds: readonly string[];
    };
