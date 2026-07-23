import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1, "name is required"),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1, "name is required").optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
