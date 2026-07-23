import { z } from "zod";

export const setValueSchema = z.object({
  value: z.union([z.string(), z.null()]),
});

export type SetValueInput = z.infer<typeof setValueSchema>;
