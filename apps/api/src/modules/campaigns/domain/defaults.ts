import type { Expression } from "./expression.js";
import type { PropertyType } from "./property.js";

export interface DefaultProperty {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly type: PropertyType;
  readonly position: number;
  readonly formula: Expression | null;
}

const prop = (propertyId: string): Expression => ({ kind: "property", propertyId });
const num = (value: string): Expression => ({ kind: "const", value });
const div = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "/", left, right });
const mul = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "*", left, right });

/** The sheet every project starts with. Not UI copy — the client names it. */
export const DEFAULT_CAMPAIGN_NAME = "Main";

/**
 * The column set a campaign starts with: the five numbers a media buyer types
 * in, and the five ratios derived from them.
 *
 * Ids are taken from the generator up front so the computed columns can
 * reference the entered ones inside a single insert.
 */
export function buildDefaultProperties(nextId: () => string): DefaultProperty[] {
  const spend = nextId();
  const impressions = nextId();
  const clicks = nextId();
  const leads = nextId();
  const revenue = nextId();

  return [
    { id: spend, key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    { id: impressions, key: "impressions", name: "IMPRESSIONS", type: "NUMBER", position: 1, formula: null },
    { id: clicks, key: "clicks", name: "CLICKS", type: "NUMBER", position: 2, formula: null },
    { id: nextId(), key: "ctr", name: "CTR", type: "PERCENT", position: 3,
      formula: mul(div(prop(clicks), prop(impressions)), num("100")) },
    { id: nextId(), key: "cpm", name: "CPM", type: "MONEY", position: 4,
      formula: mul(div(prop(spend), prop(impressions)), num("1000")) },
    { id: nextId(), key: "cpc", name: "CPC", type: "MONEY", position: 5,
      formula: div(prop(spend), prop(clicks)) },
    { id: leads, key: "leads", name: "LEADS", type: "NUMBER", position: 6, formula: null },
    { id: nextId(), key: "cpl", name: "CPL", type: "MONEY", position: 7,
      formula: div(prop(spend), prop(leads)) },
    { id: revenue, key: "revenue", name: "REVENUE", type: "MONEY", position: 8, formula: null },
    { id: nextId(), key: "roas", name: "ROAS", type: "NUMBER", position: 9,
      formula: div(prop(revenue), prop(spend)) },
    { id: nextId(), key: "comment", name: "COMMENT", type: "TEXT", position: 10, formula: null },
  ];
}
