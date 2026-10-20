import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ONLINE" | "OFFLINE";

export const PRESENCE_ACTIONS: readonly AuditAction[] = ["ONLINE", "OFFLINE"];

export interface AuditChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: Role;
  action: AuditAction;
  entityType: string;
  entityId: string;
  clientId: string | null;
  projectId: string | null;
  campaignId: string | null;
  summary: string;
  changes: AuditChange[] | null;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditEventFilters {
  clientId?: string;
  projectId?: string;
  campaignId?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  inProject?: boolean;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditActor {
  id: string;
  name: string;
}

export interface AuditEventPage {
  items: AuditEvent[];
  nextCursor: string | null;
}

export const auditEventsApi = {
  list(filters: AuditEventFilters = {}, cursor?: string) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, cursor })) {
      if (value !== undefined) params.set(key, String(value));
    }
    const query = params.toString();
    return http.get<AuditEventPage>(`/audit${query ? `?${query}` : ""}`);
  },
  actors: () => http.get<AuditActor[]>("/audit/actors"),
};
