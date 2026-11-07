import type { Company, Person } from '@/entities/crm-record/index.js';
import { type FieldOption, type Lead, type LeadColumn, type LeadField } from '@/entities/lead/index.js';
import { t } from '@/shared/config/index.js';
import type { FieldRef } from '../model/viewState.js';
import { fieldCatalogue, valueOf, type FieldKind, type FieldValue } from './catalogue.js';

export interface SchemaField<T> {
  ref: FieldRef;
  label: string;
  kind: FieldKind;
  options: readonly FieldOption[];
  value: (record: T) => FieldValue;
  listable: boolean;
  cardable: boolean;
  sortable: boolean;
  sortValue?: (record: T) => string | number | null;
}

export interface RecordSchema<T> {
  fields: SchemaField<T>[];
  searchable: (record: T) => string[];
  stageIds?: readonly string[];
}

const string = (value: string | null | undefined) => value?.trim() || null;
const field = <T>(ref: FieldRef, label: string, kind: FieldKind, value: (record: T) => FieldValue, sortable = true, options: readonly FieldOption[] = []): SchemaField<T> =>
  ({ ref, label, kind, value, options, listable: true, cardable: true, sortable });

export function leadSchema(fields: readonly LeadField[], columns: readonly LeadColumn[] = []): RecordSchema<Lead> {
  return {
    fields: fieldCatalogue(fields).map((entry) => ({
      ...entry, listable: entry.cardable || entry.ref === 'name' || entry.ref === 'stage',
      value: (lead: Lead) => valueOf(lead, entry.ref),
      sortValue: entry.ref === 'assignee' ? (lead: Lead) => lead.assignee?.name ?? null : undefined,
    })),
    searchable: (lead) => [lead.name, lead.person?.name, lead.person?.phone, lead.person?.email,
      lead.person?.telegram, lead.person?.messenger, lead.company?.name, ...lead.tags].map((value) => value ?? ''),
    stageIds: columns.map((column) => column.id),
  };
}

export function companySchema(_peopleCounts?: ReadonlyMap<string, number>, _leadCounts?: ReadonlyMap<string, number>): RecordSchema<Company> {
  return {
    fields: [
      field('name', t('crm.record.name'), 'text', (record: Company) => string(record.name)),
      field('website', t('crm.form.website'), 'text', (record: Company) => string(record.website)),
      field('phone', t('crm.card.phone'), 'text', (record: Company) => string(record.phone)),
      field('peopleCount', t('crm.record.people'), 'number', (record: Company) => String(_peopleCounts?.get(record.id) ?? record.peopleCount)),
      field('leadCount', t('crm.record.leads'), 'number', (record: Company) => String(_leadCounts?.get(record.id) ?? record.leadCount)),
      field('createdAt', t('crm.record.createdAt'), 'date', (record: Company) => record.createdAt.slice(0, 10)),
    ],
    searchable: (record) => [record.name, record.website ?? '', record.phone ?? ''],
  };
}

export function personSchema(companies: readonly Company[] = []): RecordSchema<Person> {
  const options: FieldOption[] = companies.map((company) => ({ id: company.id, name: company.name, color: 'gray' }));
  return {
    fields: [
      field('name', t('crm.record.personName'), 'text', (record: Person) => string(record.name)),
      field('company', t('crm.form.company'), 'choice', (record: Person) => record.companyId, true, options),
      field('phone', t('crm.card.phone'), 'text', (record: Person) => string(record.phone)),
      field('email', t('crm.form.email'), 'text', (record: Person) => string(record.email)),
      field('telegram', t('crm.card.telegram'), 'text', (record: Person) => string(record.telegram)),
      field('messenger', t('crm.card.messenger'), 'text', (record: Person) => string(record.messenger)),
      field('leadCount', t('crm.record.leads'), 'number', (record: Person) => String(record.leadCount)),
      field('createdAt', t('crm.record.createdAt'), 'date', (record: Person) => record.createdAt.slice(0, 10)),
    ],
    searchable: (record) => [record.name, record.phone ?? '', record.email ?? '', record.telegram ?? '', record.messenger ?? '', record.company?.name ?? ''],
  };
}
