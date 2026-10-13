import { z } from "zod";

export const createDocumentSchema = z.object({ title: z.string() }).strict();

export const updateDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
