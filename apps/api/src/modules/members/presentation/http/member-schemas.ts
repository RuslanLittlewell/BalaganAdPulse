import { z } from "zod";
import { ROLES } from "@adpulse/access-policy";

export const updateMemberSchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
}).refine((value) => value.role !== undefined || value.status !== undefined, {
  message: "role or status is required",
});

const grantSchema = z.object({
  clientId: z.uuid(),
  projectId: z.uuid().nullable().optional(),
});

export const setAccessSchema = z.object({
  grants: z.array(grantSchema),
});
