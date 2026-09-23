import { z } from "zod";
import { CURRENCIES } from "../../domain/project.js";
import { PROJECT_PRIORITIES } from "../../domain/project.js";

export const createProjectSchema = z.object({
  clientId: z.uuid("clientId must be a uuid"),
  name: z.string().min(1, "name is required"),
  budgetCurrency: z.enum(CURRENCIES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();
