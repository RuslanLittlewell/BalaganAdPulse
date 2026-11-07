import { aLead } from '@test/shared/fixtures.js';
import type { Company, Person } from '@/entities/crm-record/index.js';
import { companySchema, compareRecords, leadSchema, matchesRecord, personSchema, pruneRecordState, recordViewKey, visibleRecords, COMPANY_VIEW, PERSON_VIEW } from '@/features/lead-view-options/index.js';

const company = (id: string, name: string, overrides: Partial<Company> = {}): Company => ({
  id, orgId: 'o', clientId: 'c', name, website: null, phone: null, notes: null,
  peopleCount: 0, leadCount: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
});
const person = (id: string, name: string, overrides: Partial<Person> = {}): Person => ({
  id, orgId: 'o', clientId: 'c', name, phone: null, email: null, telegram: null, messenger: null,
  companyId: null, company: null, notes: null, leadCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

it('reads linked contact values for lead search and filters', () => {
  const anna = aLead({ person: { id: 'p1', name: 'Anna', phone: '+375291234567', email: 'anna@example.com', telegram: null, messenger: null }, company: { id: 'c1', name: 'Romashka', website: 'https://romashka.by' } });
  const empty = aLead({ id: 'other', name: 'Other' });
  const schema = leadSchema([]);
  expect(visibleRecords([anna, empty], { search: 'romash', filters: [] }, schema)).toEqual([anna]);
  expect(visibleRecords([anna, empty], { search: '1234', filters: [] }, schema)).toEqual([anna]);
  expect(matchesRecord(anna, { id: 'phone', field: 'phone', operator: 'contains', value: '1234' }, schema)).toBe(true);
  expect(matchesRecord(empty, { id: 'phone', field: 'phone', operator: 'isEmpty', value: null }, schema)).toBe(true);
});

it('filters and sorts organizations by their table fields', () => {
  const a = company('a', 'Romashka', { phone: '+375291234567', peopleCount: 3, leadCount: 2 });
  const b = company('b', 'Lutik', { peopleCount: 1, leadCount: 4 });
  const schema = companySchema();
  expect(schema.fields.map((field) => field.ref)).toEqual(['name', 'website', 'phone', 'peopleCount', 'leadCount', 'createdAt']);
  expect(visibleRecords([a, b], { search: '1234', filters: [] }, schema)).toEqual([a]);
  expect(visibleRecords([a, b], { search: '', filters: [{ id: 'f', field: 'peopleCount', operator: 'gte', value: '2' }] }, schema)).toEqual([a]);
  expect([a, b].sort(compareRecords({ field: 'leadCount', direction: 'desc' }, schema)!)).toEqual([b, a]);
});

it('filters people by organization and searches their contact values', () => {
  const romashka = company('c1', 'Romashka');
  const anna = person('p1', 'Anna', { companyId: romashka.id, company: { id: romashka.id, name: romashka.name }, email: 'anna@example.com' });
  const boris = person('p2', 'Boris', { phone: '+375291234567' });
  const schema = personSchema([romashka]);
  expect(schema.fields.find((field) => field.ref === 'company')?.options).toEqual([{ id: romashka.id, name: romashka.name, color: 'gray' }]);
  expect(visibleRecords([anna, boris], { search: 'ROMASHKA', filters: [] }, schema)).toEqual([anna]);
  expect(visibleRecords([anna, boris], { search: '1234', filters: [] }, schema)).toEqual([boris]);
  expect(visibleRecords([anna, boris], { search: '', filters: [{ id: 'f', field: 'company', operator: 'anyOf', value: [romashka.id] }] }, schema)).toEqual([anna]);
});

it('keeps separate persisted keys and removes invalid record filters', () => {
  expect(recordViewKey('u', 'companies', 'c')).not.toBe(recordViewKey('u', 'people', 'c'));
  expect(COMPANY_VIEW.cardFields[0]).toBe('name');
  expect(PERSON_VIEW.cardFields[0]).toBe('name');
  const schema = personSchema([]);
  const view = { ...PERSON_VIEW, filters: [{ id: 'f', field: 'company' as const, operator: 'anyOf' as const, value: ['missing'] }] };
  expect(pruneRecordState(view, schema).filters).toEqual([]);
});
