import { z } from "zod";
import { ROLES } from "@adpulse/access-policy";
import {
  arrayOf,
  ref,
  type ComponentDocs,
  type JsonSchema,
  type RouteDoc,
} from "#shared/presentation/openapi.js";
import { AUDIT_ACTIONS } from "#modules/audit/domain/audit-event.js";
import { auditQuerySchema } from "./audit-http.js";

const auditEvent = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  actorId: z.uuid().nullable(),
  actorName: z.string(),
  actorEmail: z.email(),
  actorRole: z.enum(ROLES),
  action: z.enum(AUDIT_ACTIONS),
  entityType: z.string(),
  entityId: z.string(),
  clientId: z.uuid().nullable(),
  projectId: z.uuid().nullable(),
  campaignId: z.uuid().nullable(),
  summary: z.string(),
  changes: z.unknown(),
  requestId: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const auditComponents: ComponentDocs = { AuditEvent: auditEvent };

const auditPage: JsonSchema = {
  type: "object",
  properties: {
    items: arrayOf(ref("AuditEvent")),
    nextCursor: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["items", "nextCursor"],
};

export const auditDoc: RouteDoc = {
  tag: "Audit",
  tagDescription: "What changed, who changed it, and when, and when members came online and went offline",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "List audit events",
      description: "Newest first, narrowed to what the actor reaches. Page on with the cursor the previous page returned.",
      query: auditQuerySchema,
      success: { status: 200, description: "A page of events", schema: auditPage },
      errors: [400, 401],
    },
    {
      method: "get",
      path: "/actors",
      summary: "List the people who appear in the events the caller may read",
      description: "Each member who is the actor of at least one reachable event, with their current name, ordered by name.",
      success: {
        status: 200,
        description: "The actors",
        schema: z.array(z.object({ id: z.uuid(), name: z.string() })),
      },
      errors: [401],
    },
  ],
};
