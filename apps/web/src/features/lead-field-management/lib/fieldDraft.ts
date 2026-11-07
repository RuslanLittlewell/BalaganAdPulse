import {
  FIELD_NAME_LIMIT,
  isListField,
  OPTION_COLORS,
  OPTION_LIMIT,
  type FieldOptionInput,
  type LeadField,
  type LeadFieldType,
  type OptionColor,
} from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";

export interface OptionDraft {
  key: string;
  id?: string;
  name: string;
  color: OptionColor;
}

export interface FieldDraft {
  name: string;
  type: LeadFieldType;
  options: OptionDraft[];
}

export interface DraftProblems {
  name?: MessageKey;
  options?: MessageKey;
}

let counter = 0;

const nextKey = () => `option-${++counter}`;

export function colorAt(index: number): OptionColor {
  return OPTION_COLORS[index % OPTION_COLORS.length]!;
}

export function newOption(index: number): OptionDraft {
  return { key: nextKey(), name: "", color: colorAt(index) };
}

export function draftOf(field?: LeadField): FieldDraft {
  if (!field) return { name: "", type: "TEXT", options: [] };
  return {
    name: field.name,
    type: field.type,
    options: field.options.map((option) => ({ key: nextKey(), id: option.id, name: option.name, color: option.color })),
  };
}

const builtInNames = () => [
  t("crm.card.amount"), t("crm.form.assignee"), t("crm.form.company"), t("crm.card.tags"), t("crm.card.service"),
  t("crm.card.phone"), t("crm.card.telegram"), t("crm.card.messenger"), t("crm.form.email"), t("crm.form.website"),
  t("crm.form.source"), t("crm.card.description"),
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function draftProblems(draft: FieldDraft, fields: readonly LeadField[], editingId?: string): DraftProblems {
  const problems: DraftProblems = {};
  const name = draft.name.trim();
  if (name === "") problems.name = "crm.fields.nameRequired";
  else if (name.length > FIELD_NAME_LIMIT) problems.name = "crm.fields.nameTooLong";
  else if (builtInNames().some((builtIn) => same(builtIn, name)) || fields.some((field) => field.id !== editingId && same(field.name, name))) {
    problems.name = "crm.fields.nameTaken";
  }
  if (isListField(draft.type)) {
    const names = draft.options.map((option) => option.name.trim().toLowerCase());
    if (draft.options.length === 0) problems.options = "crm.fields.optionsRequired";
    else if (draft.options.length > OPTION_LIMIT) problems.options = "crm.fields.optionsTooMany";
    else if (names.some((option) => option === "")) problems.options = "crm.fields.optionRequired";
    else if (new Set(names).size !== names.length) problems.options = "crm.fields.optionsDuplicate";
  }
  return problems;
}

export function optionsBody(draft: FieldDraft): FieldOptionInput[] | undefined {
  if (!isListField(draft.type)) return undefined;
  return draft.options.map(({ id, name, color }) => ({ ...(id ? { id } : {}), name: name.trim(), color }));
}

export function optionsChanged(draft: FieldDraft, field: LeadField): boolean {
  const before = field.options.map(({ id, name, color }) => ({ id, name, color }));
  return JSON.stringify(optionsBody(draft)) !== JSON.stringify(before);
}
