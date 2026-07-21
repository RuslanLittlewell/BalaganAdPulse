import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "name is required"),
  niche: z.string().optional(),
  monthlyBudget: z.number().min(0, "monthlyBudget must be >= 0").optional(),
  email: z.email("invalid email").optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
