import { z } from "zod";

/** Mirrors the Prisma enum. Kept as a literal union rather than imported from
 * the client so the schema stays readable in an error message. */
export const projectPriorities = ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"] as const;

export const createProjectSchema = z.object({
  clientId: z.uuid("clientId must be a uuid"),
  name: z.string().min(1, "name is required"),
  niche: z.string().nullable().optional(),
  monthlyBudget: z.number().min(0, "monthlyBudget must be >= 0").nullable().optional(),
  priority: z.enum(projectPriorities).optional(),
});

/** The client a project belongs to can be changed, but never unset. */
export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
