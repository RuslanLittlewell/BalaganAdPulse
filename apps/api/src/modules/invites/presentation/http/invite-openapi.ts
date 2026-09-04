import { z } from "zod";
import { ROLES } from "@adpulse/access-policy";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { createInviteSchema, listInvitesQuerySchema } from "./invite-schemas.js";

const REGISTRATION_TYPES = ["CLIENT", "EMPLOYEE", "CLIENT_STAFF"] as const;

const invite = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  code: z.string(),
  registrationType: z.enum(REGISTRATION_TYPES),
  role: z.enum(ROLES).nullable(),
  projectIds: z.array(z.uuid()),
  clientId: z.uuid().nullable(),
  email: z.email().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  usedAt: z.iso.datetime().nullable(),
  usedById: z.uuid().nullable(),
  createdById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  status: z.enum(["USED", "REVOKED", "EXPIRED", "PENDING"]),
  registrationUrl: z.string(),
});

const registration = z.object({ registrationType: z.enum(REGISTRATION_TYPES) });

export const inviteComponents: ComponentDocs = {
  Invite: invite,
  Registration: registration,
};

export const inviteDoc: RouteDoc = {
  tag: "Invitations",
  tagDescription: "Registration codes: who may issue one, and what registering against it creates",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Invite someone to register",
      description: "An employee invitation names a role and its projects; an invitation to join a client names the client.",
      body: createInviteSchema,
      success: { status: 201, description: "The invitation, with the code and the registration link", schema: ref("Invite") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/",
      summary: "List the pending invitations",
      query: listInvitesQuerySchema,
      success: { status: 200, description: "The invitations this actor reaches", schema: arrayOf(ref("Invite")) },
      errors: [400, 401, 403],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Revoke an invitation",
      success: { status: 204, description: "The invitation can no longer be redeemed" },
      errors: [401, 403, 404, 409],
    },
  ],
};

export const registrationResolverDoc: RouteDoc = {
  tag: "Invitations",
  operations: [
    {
      method: "get",
      path: "/:code",
      summary: "Resolve a registration code",
      description: "Tells the registration form which shape to take. A spent, revoked, expired or unknown code is a 404 alike.",
      open: true,
      success: { status: 200, description: "What the code registers", schema: ref("Registration") },
      errors: [404, 429],
    },
  ],
};
