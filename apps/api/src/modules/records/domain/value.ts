import { Decimal } from "decimal.js";
import { AppError } from "../../../shared/domain/index.js";
import type { Expression, PropertyType } from "../../campaigns/index.js";

/** Stored numbers keep four decimals, which is what the computed table reads
 * back and what the audit trail records. */
const SCALE = 4;
const DECIMAL = /^-?\d+(\.\d+)?$/;

export interface WritableProperty {
  readonly id: string;
  readonly name: string;
  readonly type: PropertyType;
  readonly formula: Expression | null;
}

export interface StoredCell {
  readonly numberValue: string | null;
  readonly textValue: string | null;
}

export interface ValueInput {
  readonly propertyId: string;
  readonly value: string | null;
}

export interface FieldChange {
  readonly field: string;
  readonly before: string | null;
  readonly after: string | null;
}

/** A day is stored as a pure date; UTC midnight keeps it the same date in every
 * timezone the app is read in. */
export function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function validateValue(property: WritableProperty, value: string | null): void {
  // Computed columns are never stored: their value is the formula's answer, and
  // a written one would silently disagree with it.
  if (property.formula !== null) {
    throw new AppError("validation", "Cannot write to a computed property");
  }
  if (value === null) return;
  if (property.type === "TEXT") return;
  if (!DECIMAL.test(value)) {
    throw new AppError("validation", "Property expects a numeric value");
  }
}

export function normalizeValue(property: WritableProperty, value: string | null): string | null {
  if (value === null || property.type === "TEXT") return value;
  return new Decimal(value).toFixed(SCALE);
}

/**
 * One user action is one audit event, so a multi-cell write reports every
 * column it touched with the value it held before and the value it holds now.
 */
export function describeChanges(
  properties: readonly WritableProperty[],
  stored: ReadonlyMap<string, StoredCell>,
  inputs: readonly ValueInput[],
): FieldChange[] {
  const byId = new Map(properties.map((property) => [property.id, property]));
  return inputs.map((input) => {
    const property = byId.get(input.propertyId)!;
    const before = stored.get(input.propertyId);
    return {
      field: property.name,
      before: before === undefined
        ? null
        : property.type === "TEXT" ? before.textValue : before.numberValue,
      after: normalizeValue(property, input.value),
    };
  });
}
