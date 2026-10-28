import type { Role } from "@adpulse/access-policy";

export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "ONLINE", "OFFLINE"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface StoredAuditEvent {
  readonly orgId: string;
  readonly actorId: string | null;
  readonly actorName: string;
  readonly actorEmail: string | null;
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
  readonly createdAt?: Date;
}

export type AuditScope =
  | { readonly orgId: string; readonly everything: true }
  | {
      readonly orgId: string;
      readonly everything: false;
      readonly clientIds: readonly string[];
      readonly wholeClientIds: readonly string[];
      readonly projectIds: readonly string[];
    };
