import type { PropertyType } from "@prisma/client";
import { ValidationError } from "../errors.js";
import type { Expression } from "./expression.schema.js";

export interface PropertyRef {
  id: string;
  type: PropertyType;
  formula: Expression | null;
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

/**
 * A formula may only reference numeric properties of the same campaign, may not
 * reference its own property, and may not close a reference cycle.
 */
export function assertFormulaIsValid(
  propertyId: string,
  formula: Expression,
  properties: PropertyRef[],
): void {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const refs = collectPropertyRefs(formula);

  if (refs.includes(propertyId)) {
    throw new ValidationError("Formula cannot reference its own property");
  }
  for (const ref of refs) {
    const property = byId.get(ref);
    if (!property) {
      throw new ValidationError(`Formula references a property outside this campaign: ${ref}`);
    }
    if (property.type === "TEXT") {
      throw new ValidationError(`Formula cannot reference the text property ${ref}`);
    }
  }

  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const property = byId.get(id);
    if (!property?.formula) return;
    for (const ref of collectPropertyRefs(property.formula)) {
      if (ref === propertyId) throw new ValidationError("Formula creates a circular reference");
      visit(ref);
    }
  };
  for (const ref of refs) visit(ref);
}

export function findDependents(propertyId: string, properties: PropertyRef[]): PropertyRef[] {
  return properties.filter(
    (property) => property.formula !== null && collectPropertyRefs(property.formula).includes(propertyId),
  );
}
