import { AppError } from '#shared/domain/index.js';

export const LEAD_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'LINK'] as const;
export type LeadFieldType = typeof LEAD_FIELD_TYPES[number];
export const LIST_FIELD_TYPES: readonly LeadFieldType[] = ['SELECT', 'MULTI_SELECT'];

export const OPTION_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'] as const;
export type OptionColor = typeof OPTION_COLORS[number];
export function isOptionColor(value: string): value is OptionColor {
  return (OPTION_COLORS as readonly string[]).includes(value);
}

export const FIELD_LIMIT = 30;
export const FIELD_NAME_LIMIT = 50;
export const OPTION_LIMIT = 50;
export const OPTION_NAME_LIMIT = 50;
export const TEXT_VALUE_LIMIT = 2000;
export const LINK_VALUE_LIMIT = 2048;

export const BUILT_IN_FIELD_NAMES = [
  'Сумма сделки', 'Ответственный', 'Компания', 'Метки', 'Услуга', 'Номер телефона',
  'Telegram', 'Мессенджер', 'Email', 'Сайт', 'Источник', 'Описание',
] as const;

export interface FieldOption { id: string; name: string; color: OptionColor }
export interface RequestedOption { id?: string; name: string; color: OptionColor }

export interface LeadFieldRecord {
  id: string;
  orgId: string;
  projectId: string;
  clientId: string;
  name: string;
  type: LeadFieldType;
  options: FieldOption[];
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadFieldView { id: string; name: string; type: LeadFieldType; options: FieldOption[]; position: number }

export type CustomValue = string | true | string[];
export type CustomValues = Record<string, CustomValue>;

const NUMBER = /^(-)?(\d{1,14})(?:\.(\d{1,4}))?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const refuse = (message: string): never => { throw new AppError('validation', message); };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function isListType(type: LeadFieldType): boolean {
  return LIST_FIELD_TYPES.includes(type);
}

export function fieldViewOf({ id, name, type, options, position }: LeadFieldRecord): LeadFieldView {
  return { id, name, type, options, position };
}

export function assertFieldName(fields: readonly Pick<LeadFieldRecord, 'id' | 'name'>[], name: string, except?: string): void {
  if (BUILT_IN_FIELD_NAMES.some(builtIn => same(builtIn, name))) refuse('That name belongs to a built-in lead field');
  if (fields.some(field => field.id !== except && same(field.name, name))) refuse('A field with that name already exists on this board');
}

export function settleOptions(
  type: LeadFieldType,
  current: readonly FieldOption[],
  requested: readonly RequestedOption[] | undefined,
  newId: () => string,
): { options: FieldOption[]; removed: string[] } {
  if (!isListType(type)) {
    if (requested !== undefined && requested.length > 0) refuse('Only list fields carry options');
    return { options: [], removed: [] };
  }
  if (requested === undefined) return { options: [...current], removed: [] };
  if (requested.length === 0) refuse('A list field needs at least one option');
  if (requested.length > OPTION_LIMIT) refuse(`A list field holds at most ${OPTION_LIMIT} options`);
  const known = new Set(current.map(option => option.id));
  const options = requested.map(option => {
    if (option.id !== undefined && !known.has(option.id)) refuse('That option does not belong to this field');
    return { id: option.id ?? newId(), name: option.name, color: option.color };
  });
  if (new Set(options.map(option => option.id)).size !== options.length) refuse('An option is listed twice');
  if (new Set(options.map(option => option.name.toLowerCase())).size !== options.length) refuse('Options of a field must differ from each other');
  const kept = new Set(options.map(option => option.id));
  return { options, removed: current.filter(option => !kept.has(option.id)).map(option => option.id) };
}

function canonicalNumber(raw: string): string | null {
  const match = NUMBER.exec(raw);
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const integer = whole!.replace(/^0+(?=\d)/, '');
  const decimals = fraction.padEnd(4, '0');
  const zero = /^0+$/.test(integer) && /^0+$/.test(decimals);
  return `${sign && !zero ? '-' : ''}${integer}.${decimals}`;
}

function isCalendarDay(raw: string): boolean {
  const match = DAY.exec(raw);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isWebAddress(raw: string): boolean {
  if (!URL.canParse(raw)) return false;
  return ['http:', 'https:'].includes(new URL(raw).protocol);
}

function text(field: Pick<LeadFieldRecord, 'name'>, raw: unknown): string | null {
  if (typeof raw !== 'string') return refuse(`Field "${field.name}" expects text`);
  const value = raw.trim();
  return value === '' ? null : value;
}

export function normalizeValue(field: Pick<LeadFieldRecord, 'name' | 'type' | 'options'>, raw: unknown): CustomValue | null {
  if (raw === null || raw === undefined) return null;
  switch (field.type) {
    case 'TEXT': {
      const value = text(field, raw);
      if (value !== null && value.length > TEXT_VALUE_LIMIT) refuse(`Field "${field.name}" holds at most ${TEXT_VALUE_LIMIT} characters`);
      return value;
    }
    case 'NUMBER': {
      const value = text(field, raw);
      if (value === null) return null;
      return canonicalNumber(value) ?? refuse(`Field "${field.name}" expects a number with at most four decimals`);
    }
    case 'DATE': {
      const value = text(field, raw);
      if (value === null) return null;
      return isCalendarDay(value) ? value : refuse(`Field "${field.name}" expects a calendar day written YYYY-MM-DD`);
    }
    case 'LINK': {
      const value = text(field, raw);
      if (value === null) return null;
      if (value.length > LINK_VALUE_LIMIT || !isWebAddress(value)) refuse(`Field "${field.name}" expects an HTTP or HTTPS address`);
      return value;
    }
    case 'CHECKBOX': {
      if (typeof raw !== 'boolean') return refuse(`Field "${field.name}" expects true or false`);
      return raw ? true : null;
    }
    case 'SELECT': {
      const value = text(field, raw);
      if (value === null) return null;
      return field.options.some(option => option.id === value) ? value : refuse(`Field "${field.name}" has no such option`);
    }
    case 'MULTI_SELECT': {
      if (!Array.isArray(raw) || raw.some(item => typeof item !== 'string')) return refuse(`Field "${field.name}" expects a list of options`);
      const chosen = new Set(raw as string[]);
      if (chosen.size !== raw.length) refuse(`Field "${field.name}" lists an option twice`);
      if ([...chosen].some(id => !field.options.some(option => option.id === id))) refuse(`Field "${field.name}" has no such option`);
      const ordered = field.options.filter(option => chosen.has(option.id)).map(option => option.id);
      return ordered.length === 0 ? null : ordered;
    }
  }
}

export function applyCustomValues(
  fields: readonly Pick<LeadFieldRecord, 'id' | 'name' | 'type' | 'options'>[],
  current: CustomValues,
  patch: Readonly<Record<string, unknown>> | undefined,
): CustomValues {
  const byId = new Map(fields.map(field => [field.id, field]));
  const next: CustomValues = Object.fromEntries(Object.entries(current).filter(([id]) => byId.has(id)));
  for (const [id, raw] of Object.entries(patch ?? {})) {
    const field = byId.get(id) ?? refuse('That field does not belong to this board');
    const value = normalizeValue(field, raw);
    if (value === null) delete next[id];
    else next[id] = value;
  }
  return next;
}

export function withoutOptions(values: CustomValues, fieldId: string, removed: ReadonlySet<string>): CustomValues | null {
  const value = values[fieldId];
  if (value === undefined) return null;
  if (typeof value === 'string') {
    if (!removed.has(value)) return null;
    const { [fieldId]: _dropped, ...rest } = values;
    return rest;
  }
  if (!Array.isArray(value) || !value.some(id => removed.has(id))) return null;
  const left = value.filter(id => !removed.has(id));
  if (left.length > 0) return { ...values, [fieldId]: left };
  const { [fieldId]: _dropped, ...rest } = values;
  return rest;
}

export function customValuesOf(raw: unknown): CustomValues {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as CustomValues;
}
