import { z } from "zod";
import { NAME_LIMIT, atMost } from "#shared/presentation/input-schemas.js";

const projectFieldsSchema = z.object({
  clientId: z.uuid("clientId must be a uuid"),
  name: z.string().min(1, "name is required").max(NAME_LIMIT, `name ${atMost(NAME_LIMIT)}`),
});

export const createProjectSchema = projectFieldsSchema.extend({
  memberIds: z.array(z.uuid("memberIds must hold uuids")).optional(),
});

export const updateProjectSchema = projectFieldsSchema.extend({ kpiTracked: z.boolean() }).partial();
