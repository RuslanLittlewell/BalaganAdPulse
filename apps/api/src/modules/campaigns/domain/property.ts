import { AppError } from "../../../shared/domain/index.js";
import { collectPropertyRefs, type Expression } from "./expression.js";

export const PROPERTY_TYPES = ["NUMBER", "MONEY", "PERCENT", "TEXT"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface PropertyRef {
  readonly id: string;
  readonly type: PropertyType;
  readonly formula: Expression | null;
}

/**
 * A formula may only reference numeric properties of the same campaign, may not
 * reference its own property, and may not close a reference cycle. Rejecting
 * cycles here is what lets the table evaluator recurse without a depth guard.
 */
export function assertFormulaIsValid(
  propertyId: string,
  formula: Expression,
  properties: readonly PropertyRef[],
): void {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const refs = collectPropertyRefs(formula);

  if (refs.includes(propertyId)) {
    throw new AppError("validation", "Formula cannot reference its own property");
  }
  for (const ref of refs) {
    const property = byId.get(ref);
    if (!property) {
      throw new AppError("validation", `Formula references a property outside this campaign: ${ref}`);
    }
    if (property.type === "TEXT") {
      throw new AppError("validation", `Formula cannot reference the text property ${ref}`);
    }
  }

  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const property = byId.get(id);
    if (!property?.formula) return;
    for (const ref of collectPropertyRefs(property.formula)) {
      if (ref === propertyId) throw new AppError("validation", "Formula creates a circular reference");
      visit(ref);
    }
  };
  for (const ref of refs) visit(ref);
}

export function findDependents(
  propertyId: string,
  properties: readonly PropertyRef[],
): PropertyRef[] {
  return properties.filter(
    (property) =>
      property.formula !== null && collectPropertyRefs(property.formula).includes(propertyId),
  );
}

/** Computed columns are never stored: their value is the formula's answer, and
 * a written one would silently disagree with it. */
export function assertWritable(property: { formula: Expression | null }): void {
  if (property.formula !== null) {
    throw new AppError("validation", "Cannot write to a computed property");
  }
}
