import { z } from "zod";
import { MODULES } from "@adpulse/access-policy";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { ORGANIZATION_STATUSES } from "#modules/platform/domain/organization.js";
import { createOrganizationSchema, updateOrganizationSchema } from "./platform-schemas.js";

const platformOrganization = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(ORGANIZATION_STATUSES),
  modules: z.array(z.enum(MODULES)),
  activeMembers: z.number().int(),
  createdAt: z.iso.datetime(),
  firstAdmin: z.object({
    email: z.email().nullable(),
    state: z.enum(["PENDING", "ACCEPTED"]),
    registrationUrl: z.string().nullable(),
  }).nullable(),
});

const createdOrganization = z.object({
  organization: platformOrganization,
  registrationUrl: z.string(),
});

export const platformComponents: ComponentDocs = {
  PlatformOrganization: platformOrganization,
  CreatedOrganization: createdOrganization,
};

export const platformDoc: RouteDoc = {
  tag: "Platform",
  tagDescription: "The organizations using this instance, managed by the platform administrator alone",
  operations: [
    {
      method: "get",
      path: "/organizations",
      summary: "List every organization on the instance",
      description: "Oldest first, with the modules each is entitled to, its active members and the state of its first administrator's invitation.",
      success: { status: 200, description: "The organizations", schema: arrayOf(ref("PlatformOrganization")) },
      errors: [401, 403],
    },
    {
      method: "post",
      path: "/organizations",
      summary: "Add an organization",
      description: "Dashboard and Projects are always enabled; the listed optional modules are added to them. An admin invitation is issued for the given email, and its registration link returned.",
      body: createOrganizationSchema,
      success: { status: 201, description: "The organization and its first administrator's registration link", schema: ref("CreatedOrganization") },
      errors: [400, 401, 403, 409],
    },
    {
      method: "patch",
      path: "/organizations/:id",
      summary: "Rename an organization, change its modules, or suspend or reactivate it",
      description: "Removing a module hides it without deleting its data. A suspended organization's members are refused on every request until it is reactivated.",
      body: updateOrganizationSchema,
      success: { status: 200, description: "The organization as it now stands", schema: ref("PlatformOrganization") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/organizations/:id",
      summary: "Delete an organization",
      description: "Irreversible. Removes the organization with everything it holds, and the accounts of its people that belong to no other organization.",
      success: { status: 204, description: "The organization is gone" },
      errors: [401, 403, 404],
    },
  ],
};
