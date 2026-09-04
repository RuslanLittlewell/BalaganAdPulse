import { z } from "zod";
import { ROLES } from "@adpulse/access-policy";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { MEMBER_KINDS } from "../../application/ports.js";
import { setAccessSchema, updateMemberSchema } from "./member-schemas.js";

const member = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  orgId: z.uuid(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  phone: z.string().nullable(),
  telegram: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  createdAt: z.iso.datetime(),
});

const accessGrant = z.object({
  membershipId: z.uuid(),
  clientId: z.uuid(),
  projectId: z.uuid().nullable(),
});

const session = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
  }),
  organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
  role: z.enum(ROLES),
  clientIds: z.array(z.uuid()),
});

export const memberComponents: ComponentDocs = {
  Member: member,
  AccessGrant: accessGrant,
  Session: session,
};

export const memberDoc: RouteDoc = {
  tag: "Members",
  tagDescription: "The people in the organization, their roles and the clients they reach",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "List the organization's members",
      description: "Naming a client lists that client's own people instead of the agency's.",
      query: z.object({
        kind: z.enum(MEMBER_KINDS).optional(),
        clientId: z.uuid().optional(),
      }),
      success: { status: 200, description: "The members", schema: arrayOf(ref("Member")) },
      errors: [400, 401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id",
      summary: "Change a member's role or status",
      body: updateMemberSchema,
      success: { status: 200, description: "The member as it now stands", schema: ref("Member") },
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Remove a member from the organization",
      success: { status: 204, description: "The membership is gone" },
      errors: [401, 403, 404, 409],
    },
    {
      method: "get",
      path: "/:id/avatar",
      summary: "Read a member's avatar",
      success: {
        status: 200,
        description: "The avatar as a PNG",
        contentType: "image/png",
        schema: { type: "string", format: "binary" },
      },
      errors: [401, 403, 404],
    },
    {
      method: "get",
      path: "/:id/access",
      summary: "List a member's grants",
      success: { status: 200, description: "The grants", schema: arrayOf(ref("AccessGrant")) },
      errors: [401, 403, 404],
    },
    {
      method: "put",
      path: "/:id/access",
      summary: "Replace a member's grants",
      description: "A grant naming no project reaches the whole client.",
      body: setAccessSchema,
      success: { status: 200, description: "The grants as they now stand", schema: arrayOf(ref("AccessGrant")) },
      errors: [400, 401, 403, 404],
    },
  ],
};

export const sessionDoc: RouteDoc = {
  tag: "Session",
  tagDescription: "Who the caller is, where they belong and what they reach",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "Describe the signed-in session",
      description: "The user, their organization, their role and the clients they reach.",
      success: { status: 200, description: "The session", schema: ref("Session") },
      errors: [401, 403, 404],
    },
  ],
};
