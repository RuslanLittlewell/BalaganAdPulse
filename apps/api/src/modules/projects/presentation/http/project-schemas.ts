import { z } from "zod";

const projectFieldsSchema = z.object({
  clientId: z.uuid("clientId must be a uuid"),
  name: z.string().min(1, "name is required"),
});

export const createProjectSchema = projectFieldsSchema.extend({
  memberIds: z.array(z.uuid("memberIds must hold uuids")).optional(),
});

export const updateProjectSchema = projectFieldsSchema.extend({ kpiTracked: z.boolean() }).partial();
