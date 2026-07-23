import { z } from "zod";
import { expressionSchema } from "../formula/expression.schema.js";

export const columnTypeSchema = z.enum(["NUMBER", "MONEY", "PERCENT", "TEXT"]);

export const createPropertySchema = z.object({
  name: z.string().min(1, "name is required"),
  type: columnTypeSchema,
  formula: expressionSchema.nullable().optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export const updatePropertySchema = z.object({
  name: z.string().min(1, "name is required").optional(),
  type: columnTypeSchema.optional(),
  formula: expressionSchema.nullable().optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
