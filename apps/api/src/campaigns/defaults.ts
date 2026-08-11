import { randomUUID } from "node:crypto";
import type { PropertyType } from "@prisma/client";
import type { Expression } from "../formula/expression.schema.js";
import { toJson } from "../formula/expression.schema.js";

export interface DefaultPropertySeed {
  id: string;
  key: string;
  name: string;
  type: PropertyType;
  position: number;
  formula: Expression | null;
}

const prop = (propertyId: string): Expression => ({ kind: "property", propertyId });
const num = (value: string): Expression => ({ kind: "const", value });
const div = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "/", left, right });
const mul = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "*", left, right });

/**
 * The property set a campaign starts with. Ids are generated up front so the
 * computed properties can reference the entered ones inside a single insert.
 */
export function buildDefaultProperties(): DefaultPropertySeed[] {
  const spend = randomUUID();
  const impressions = randomUUID();
  const clicks = randomUUID();
  const leads = randomUUID();
  const revenue = randomUUID();

  return [
    { id: spend, key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    { id: impressions, key: "impressions", name: "IMPRESSIONS", type: "NUMBER", position: 1, formula: null },
    { id: clicks, key: "clicks", name: "CLICKS", type: "NUMBER", position: 2, formula: null },
    { id: randomUUID(), key: "ctr", name: "CTR", type: "PERCENT", position: 3,
      formula: mul(div(prop(clicks), prop(impressions)), num("100")) },
    { id: randomUUID(), key: "cpm", name: "CPM", type: "MONEY", position: 4,
      formula: mul(div(prop(spend), prop(impressions)), num("1000")) },
    { id: randomUUID(), key: "cpc", name: "CPC", type: "MONEY", position: 5,
      formula: div(prop(spend), prop(clicks)) },
    { id: leads, key: "leads", name: "LEADS", type: "NUMBER", position: 6, formula: null },
    { id: randomUUID(), key: "cpl", name: "CPL", type: "MONEY", position: 7,
      formula: div(prop(spend), prop(leads)) },
    { id: revenue, key: "revenue", name: "REVENUE", type: "MONEY", position: 8, formula: null },
    { id: randomUUID(), key: "roas", name: "ROAS", type: "NUMBER", position: 9,
      formula: div(prop(revenue), prop(spend)) },
    { id: randomUUID(), key: "comment", name: "COMMENT", type: "TEXT", position: 10, formula: null },
  ];
}

/** The sheet every client starts with. Not UI copy — the client names it. */
export const DEFAULT_CAMPAIGN_NAME = "Main";

/**
 * Prisma create input for a campaign and its default properties, without `clientId`.
 * The campaign service supplies it explicitly; the client service nests this under
 * its own create, where Prisma fills it in.
 */
export function buildCampaignCreateData(name: string, position: number) {
  return {
    name,
    position,
    properties: {
      create: buildDefaultProperties().map((property) => ({
        id: property.id,
        key: property.key,
        name: property.name,
        type: property.type,
        position: property.position,
        formula: toJson(property.formula),
      })),
    },
  };
}
