import { Prisma } from "@prisma/client";
import { z } from "zod";

export type BinaryOperator = "+" | "-" | "*" | "/";

export type Expression =
  | { kind: "binary"; op: BinaryOperator; left: Expression; right: Expression }
  | { kind: "property"; propertyId: string }
  | { kind: "const"; value: string };

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

// Prisma types JSON fields structurally; an Expression is JSON-safe by construction,
// so the cast is the documented way to hand it over without widening the domain type.
export function toJson(formula: Expression | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return formula === null ? Prisma.DbNull : (formula as unknown as Prisma.InputJsonValue);
}

export function fromJson(value: Prisma.JsonValue | null): Expression | null {
  return value === null ? null : (value as unknown as Expression);
}
