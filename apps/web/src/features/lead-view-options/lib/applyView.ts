import type { Lead, LeadColumn, LeadField } from '@/entities/lead/index.js';
import type { Filter, Sort, ViewState } from '../model/viewState.js';
import { compareRecords, matchesRecord, pruneRecordState, visibleRecords } from './applyRecords.js';
import { leadSchema } from './recordSchema.js';

export function matches(lead: Lead, filter: Filter, fields: readonly LeadField[]): boolean {
  return matchesRecord(lead, filter, leadSchema(fields));
}

export function matchesSearch(lead: Lead, search: string): boolean {
  return visibleRecords([lead], { search, filters: [] }, leadSchema([])).length > 0;
}

export function visibleLeads(leads: readonly Lead[], view: Pick<ViewState, 'search' | 'filters'>, fields: readonly LeadField[]): Lead[] {
  return visibleRecords(leads, view, leadSchema(fields));
}

export function compareBy(sort: Sort, fields: readonly LeadField[]): ((a: Lead, b: Lead) => number) | null {
  return compareRecords(sort, leadSchema(fields));
}

export function pruneState(view: ViewState, fields: readonly LeadField[], columns: readonly LeadColumn[]): ViewState {
  return pruneRecordState(view, leadSchema(fields, columns));
}
