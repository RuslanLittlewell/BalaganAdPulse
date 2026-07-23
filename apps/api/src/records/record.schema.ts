import { z } from "zod";

export const createRecordSchema = z.object({
  date: z.iso.date("date must be in YYYY-MM-DD format"),
});

export const updateRecordSchema = createRecordSchema;

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
