import { z } from "zod";
import { OPTIONAL_MODULES } from "@adpulse/access-policy";
import { ORGANIZATION_STATUSES } from "#modules/platform/domain/organization.js";

const name = z.string().trim().min(1, "name is required").max(120);
const modules = z.array(z.enum(OPTIONAL_MODULES));
const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));

export const createOrganizationSchema = z.object({
  name,
  modules,
  adminEmail: email,
}).strict();

export const updateOrganizationSchema = z.object({
  name: name.optional(),
  modules: modules.optional(),
  status: z.enum(ORGANIZATION_STATUSES).optional(),
}).strict();

export const organizationParamsSchema = z.object({ id: z.uuid() });
