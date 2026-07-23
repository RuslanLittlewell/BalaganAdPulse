import { Prisma, type PropertyType } from "@prisma/client";
import { evaluate, type ValueResolver } from "./evaluate.js";
import type { Expression } from "./expression.schema.js";
import { formatDate } from "../lib/date.js";

const SCALE = 4;

export interface TableProperty {
  id: string;
  key: string | null;
  name: string;
  type: PropertyType;
  position: number;
  formula: Expression | null;
}

export interface StoredValue {
  propertyId: string;
  numberValue: Prisma.Decimal | null;
  textValue: string | null;
}

export interface TableRecord {
  id: string;
  date: Date;
  storedValues: StoredValue[];
}

export interface ComputedRecord {
  id: string;
  date: string;
  values: Record<string, string | null>;
}

export interface ComputedTable {
  records: ComputedRecord[];
  totals: Record<string, string | null>;
}

function format(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(SCALE);
}

/**
 * Resolves a property to a number: entered properties read from `entered`, computed
 * properties evaluate their formula through the same resolver. Cycles are rejected
 * when a formula is saved, so the recursion always terminates; results are memoized
 * so a shared operand is evaluated once per record.
 */
function makeResolver(
  properties: TableProperty[],
  entered: Map<string, Prisma.Decimal | null>,
): ValueResolver {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const cache = new Map<string, Prisma.Decimal | null>();

  const resolve: ValueResolver = (propertyId) => {
    const cached = cache.get(propertyId);
    if (cached !== undefined) return cached;
    cache.set(propertyId, null); // guards against re-entry while evaluating

    const property = byId.get(propertyId);
    let value: Prisma.Decimal | null = null;
    if (property && property.type !== "TEXT") {
      value = property.formula
        ? evaluate(property.formula, resolve)
        : entered.get(propertyId) ?? null;
    }
    cache.set(propertyId, value);
    return value;
  };

  return resolve;
}

export function computeTable(properties: TableProperty[], records: TableRecord[]): ComputedTable {
  const computedRecords = records.map((record) => {
    const entered = new Map<string, Prisma.Decimal | null>();
    const texts = new Map<string, string | null>();
    for (const stored of record.storedValues) {
      entered.set(stored.propertyId, stored.numberValue);
      texts.set(stored.propertyId, stored.textValue);
    }
    const resolve = makeResolver(properties, entered);

    const values: Record<string, string | null> = {};
    for (const property of properties) {
      values[property.id] = property.type === "TEXT"
        ? texts.get(property.id) ?? null
        : format(resolve(property.id));
    }
    return { id: record.id, date: formatDate(record.date), values };
  });

  const aggregated = new Map<string, Prisma.Decimal | null>();
  for (const property of properties) {
    if (property.formula !== null || property.type === "TEXT") continue;
    const values = records
      .flatMap((record) => record.storedValues.filter((stored) => stored.propertyId === property.id))
      .map((stored) => stored.numberValue)
      .filter((value): value is Prisma.Decimal => value !== null);
    if (values.length === 0) {
      aggregated.set(property.id, null);
      continue;
    }
    const sum = values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
    aggregated.set(property.id, property.type === "PERCENT" ? sum.div(values.length) : sum);
  }

  const resolveTotals = makeResolver(properties, aggregated);
  const totals: Record<string, string | null> = {};
  for (const property of properties) {
    totals[property.id] = property.type === "TEXT" ? null : format(resolveTotals(property.id));
  }

  return { records: computedRecords, totals };
}
