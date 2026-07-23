import { Prisma } from "@prisma/client";
import type { Expression } from "./expression.schema.js";

export type ValueResolver = (propertyId: string) => Prisma.Decimal | null;

/** Null is contagious: an empty operand makes the whole expression empty. */
export function evaluate(expression: Expression, resolve: ValueResolver): Prisma.Decimal | null {
  switch (expression.kind) {
    case "const":
      return new Prisma.Decimal(expression.value);
    case "property":
      return resolve(expression.propertyId);
    case "binary": {
      const left = evaluate(expression.left, resolve);
      if (left === null) return null;
      const right = evaluate(expression.right, resolve);
      if (right === null) return null;
      switch (expression.op) {
        case "+": return left.plus(right);
        case "-": return left.minus(right);
        case "*": return left.times(right);
        // A record with zero impressions is ordinary data, not an error.
        case "/": return right.isZero() ? null : left.div(right);
      }
    }
  }
}
