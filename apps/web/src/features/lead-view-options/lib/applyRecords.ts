import { type Filter, type FieldRef, type Sort, type ViewState } from '../model/viewState.js';
import { needsValue, type FieldValue } from './catalogue.js';
import type { RecordSchema, SchemaField } from './recordSchema.js';

const lower = (value: string) => value.toLocaleLowerCase('ru');
const empty = (value: FieldValue) => value === null || value === false || (Array.isArray(value) && value.length === 0);
const fieldOf = <T>(schema: RecordSchema<T>, ref: FieldRef) => schema.fields.find((field) => field.ref === ref);
const list = (value: FieldValue) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
const incomplete = (filter: Filter) => needsValue(filter.operator) &&
  (filter.value === null || (Array.isArray(filter.value) ? filter.value.length === 0 : filter.value.trim() === ''));

export function matchesRecord<T>(record: T, filter: Filter, schema: RecordSchema<T>): boolean {
  const field = fieldOf(schema, filter.field);
  if (!field || incomplete(filter)) return true;
  const value = field.value(record);
  const day = typeof value === 'string' ? value.slice(0, 10) : null;
  switch (filter.operator) {
    case 'isEmpty': return empty(value);
    case 'isNotEmpty': return !empty(value);
    case 'checked': return value === true;
    case 'unchecked': return value !== true;
    case 'contains': return typeof value === 'string' && lower(value).includes(lower(String(filter.value)));
    case 'notContains': return !(typeof value === 'string' && lower(value).includes(lower(String(filter.value))));
    case 'gte': return typeof value === 'string' && Number(value) >= Number(filter.value);
    case 'lte': return typeof value === 'string' && Number(value) <= Number(filter.value);
    case 'on': return day === filter.value;
    case 'before': return day !== null && day < String(filter.value);
    case 'after': return day !== null && day > String(filter.value);
    case 'anyOf': return list(value).some((item) => list(filter.value).includes(item));
    case 'noneOf': return !list(value).some((item) => list(filter.value).includes(item));
  }
}

export function visibleRecords<T>(records: readonly T[], view: Pick<ViewState, 'search' | 'filters'>, schema: RecordSchema<T>): T[] {
  const query = lower(view.search.trim());
  return records.filter((record) => (query === '' || schema.searchable(record).some((value) => lower(value).includes(query))) &&
    view.filters.every((filter) => matchesRecord(record, filter, schema)));
}

function sortKey<T>(record: T, field: SchemaField<T>): string | number | null {
  if (field.sortValue) return field.sortValue(record);
  const value = field.value(record);
  if (empty(value)) return null;
  if (field.kind === 'number') return Number(value);
  if (field.kind === 'checkbox') return value === true ? 1 : null;
  if (field.kind === 'choice') {
    const index = field.options.findIndex((option) => option.id === value);
    return index < 0 ? null : index;
  }
  return typeof value === 'string' ? value : null;
}

export function compareRecords<T>(sort: Sort, schema: RecordSchema<T>): ((a: T, b: T) => number) | null {
  const field = fieldOf(schema, sort.field);
  if (!field?.sortable) return null;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return (left, right) => {
    const a = sortKey(left, field);
    const b = sortKey(right, field);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ru')) * sign;
  };
}

export function pruneRecordState<T>(view: ViewState, schema: RecordSchema<T>): ViewState {
  const keep = (ref: FieldRef) => fieldOf(schema, ref) !== undefined;
  const filters = view.filters.flatMap((filter) => {
    const field = fieldOf(schema, filter.field);
    if (!field) return [];
    if (!Array.isArray(filter.value)) return [filter];
    const ids = field.kind === 'stage' ? schema.stageIds : field.kind === 'choice' || field.kind === 'choices' ? field.options.map((option) => option.id) : undefined;
    if (!ids) return [filter];
    const value = filter.value.filter((id) => ids.includes(id));
    return value.length === 0 ? [] : [value.length === filter.value.length ? filter : { ...filter, value }];
  });
  const sort = view.sort && keep(view.sort.field) ? view.sort : null;
  const cardFields = view.cardFields.filter(keep);
  return filters.length === view.filters.length && filters.every((filter, index) => filter === view.filters[index]) && sort === view.sort && cardFields.length === view.cardFields.length
    ? view : { ...view, filters, sort, cardFields };
}

export function schemaField<T>(schema: RecordSchema<T>, ref: FieldRef): SchemaField<T> | null {
  return fieldOf(schema, ref) ?? null;
}
