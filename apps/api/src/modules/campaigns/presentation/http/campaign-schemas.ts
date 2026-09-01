import { z } from "zod";
import { PROPERTY_TYPES } from "../../domain/property.js";
import type { Expression } from "../../domain/expression.js";

export const createCampaignSchema = z.object({
  name: z.string().min(1, "name is required"),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1, "name is required").optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("binary"),
      op: z.enum(["+", "-", "*", "/"]),
      left: expressionSchema,
      right: expressionSchema,
    }),
    z.object({
      kind: z.literal("property"),
      propertyId: z.uuid("propertyId must be a uuid"),
    }),
    z.object({
      kind: z.literal("const"),
      value: z.string().regex(/^-?\d+(\.\d+)?$/, "const value must be a decimal string"),
    }),
  ]),
);

export const columnTypeSchema = z.enum(PROPERTY_TYPES);

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
