import { z } from "zod";
import { PROJECT_PRIORITIES } from "../../domain/project.js";

export const createProjectSchema = z.object({
  clientId: z.uuid("clientId must be a uuid"),
  name: z.string().min(1, "name is required"),
  niche: z.string().nullable().optional(),
  monthlyBudget: z.number().min(0, "monthlyBudget must be >= 0").nullable().optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
});

/** The client a project belongs to can be changed, but never unset. */
export const updateProjectSchema = createProjectSchema.partial();
