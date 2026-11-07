import { arrivalIso, type FieldOption, type Lead, type LeadField } from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { customIdOf, customRef, type BuiltInField, type FieldRef, type Operator } from "../model/viewState.js";

export type FieldKind = "text" | "number" | "date" | "arrival" | "stage" | "member" | "choice" | "choices" | "tags" | "checkbox";

export interface CatalogueField {
  ref: FieldRef;
  label: string;
  kind: FieldKind;
  options: readonly FieldOption[];
  cardable: boolean;
  sortable: boolean;
}

type BuiltInSpec = { label: MessageKey; kind: FieldKind; cardable: boolean; sortable: boolean };

const BUILT_IN: Record<BuiltInField, BuiltInSpec> = {
  name: { label: "crm.view.field.name", kind: "text", cardable: false, sortable: true },
  stage: { label: "crm.view.field.stage", kind: "stage", cardable: false, sortable: false },
  amount: { label: "crm.card.amount", kind: "number", cardable: true, sortable: true },
  assignee: { label: "crm.form.assignee", kind: "member", cardable: true, sortable: true },
  person: { label: "crm.form.person", kind: "text", cardable: true, sortable: true },
  company: { label: "crm.form.company", kind: "text", cardable: true, sortable: true },
  tags: { label: "crm.card.tags", kind: "tags", cardable: true, sortable: false },
  service: { label: "crm.card.service", kind: "text", cardable: true, sortable: false },
  phone: { label: "crm.card.phone", kind: "text", cardable: true, sortable: false },
  telegram: { label: "crm.card.telegram", kind: "text", cardable: true, sortable: false },
  messenger: { label: "crm.card.messenger", kind: "text", cardable: true, sortable: false },
  email: { label: "crm.form.email", kind: "text", cardable: true, sortable: false },
  website: { label: "crm.form.website", kind: "text", cardable: true, sortable: false },
  source: { label: "crm.form.source", kind: "text", cardable: true, sortable: false },
  arrival: { label: "crm.view.field.arrival", kind: "arrival", cardable: true, sortable: true },
};

const CUSTOM_KIND: Record<LeadField["type"], FieldKind> = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECT: "choice",
  MULTI_SELECT: "choices",
  CHECKBOX: "checkbox",
  LINK: "text",
};

export function fieldCatalogue(fields: readonly LeadField[]): CatalogueField[] {
  const builtIns = (Object.keys(BUILT_IN) as BuiltInField[]).map((ref) => ({
    ref, label: t(BUILT_IN[ref].label), kind: BUILT_IN[ref].kind, options: [],
    cardable: BUILT_IN[ref].cardable, sortable: BUILT_IN[ref].sortable,
  }));
  const custom = fields.map((field) => ({
    ref: customRef(field.id), label: field.name, kind: CUSTOM_KIND[field.type], options: field.options,
    cardable: true, sortable: field.type !== "MULTI_SELECT",
  }));
  return [...builtIns, ...custom];
}

export function catalogueField(ref: FieldRef, fields: readonly LeadField[]): CatalogueField | null {
  return fieldCatalogue(fields).find((field) => field.ref === ref) ?? null;
}

const OPERATORS: Record<FieldKind, readonly Operator[]> = {
  text: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  number: ["gte", "lte", "isEmpty", "isNotEmpty"],
  arrival: ["on", "before", "after"],
  date: ["on", "before", "after", "isEmpty", "isNotEmpty"],
  stage: ["anyOf", "noneOf"],
  member: ["anyOf", "noneOf", "isEmpty", "isNotEmpty"],
  choice: ["anyOf", "noneOf", "isEmpty", "isNotEmpty"],
  choices: ["anyOf", "noneOf", "isEmpty", "isNotEmpty"],
  tags: ["anyOf", "noneOf", "isEmpty", "isNotEmpty"],
  checkbox: ["checked", "unchecked"],
};

export function operatorsFor(kind: FieldKind): readonly Operator[] {
  return OPERATORS[kind];
}

export function needsValue(operator: Operator): boolean {
  return !["isEmpty", "isNotEmpty", "checked", "unchecked"].includes(operator);
}

export type FieldValue = string | string[] | boolean | null;

function text(value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? value : null;
}

export function valueOf(lead: Lead, ref: FieldRef): FieldValue {
  const customId = customIdOf(ref);
  if (customId !== null) {
    const value = lead.customValues?.[customId];
    if (value === undefined) return null;
    return value;
  }
  switch (ref as BuiltInField) {
    case "name": return text(lead.name);
    case "stage": return lead.stage;
    case "amount": return lead.amount;
    case "assignee": return lead.assigneeId;
    case "tags": return lead.tags.length > 0 ? lead.tags : null;
    case "arrival": return arrivalIso(lead);
    case "person": return text(lead.person?.name);
    case "company": return text(lead.company?.name);
    case "service": return text(lead.service);
    case "phone": return text(lead.person?.phone);
    case "telegram": return text(lead.person?.telegram);
    case "messenger": return text(lead.person?.messenger);
    case "email": return text(lead.person?.email);
    case "website": return text(lead.company?.website);
    case "source": return text(lead.source);
  }
}
