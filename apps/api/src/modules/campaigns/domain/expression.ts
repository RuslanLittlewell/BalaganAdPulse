import { Decimal } from "decimal.js";

export type BinaryOperator = "+" | "-" | "*" | "/";

export type Expression =
  | { kind: "binary"; op: BinaryOperator; left: Expression; right: Expression }
  | { kind: "property"; propertyId: string }
  | { kind: "const"; value: string };

export type ValueResolver = (propertyId: string) => Decimal | null;

/** Null is contagious: an empty operand makes the whole expression empty. */
export function evaluate(expression: Expression, resolve: ValueResolver): Decimal | null {
  switch (expression.kind) {
    case "const":
      return new Decimal(expression.value);
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

export function collectPropertyRefs(expression: Expression): string[] {
  const found = new Set<string>();
  const walk = (node: Expression): void => {
    if (node.kind === "property") found.add(node.propertyId);
    if (node.kind === "binary") { walk(node.left); walk(node.right); }
  };
  walk(expression);
  return [...found];
}
