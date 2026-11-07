import { useMemo } from 'react';
import { ColumnPill, FIXED_LEAD_COLUMNS, type Lead, type LeadColumn, type LeadField } from '@/entities/lead/index.js';
import { compareRecords, leadSchema, visibleRecords, type Sort, type ViewState } from '@/features/lead-view-options/index.js';
import { RecordTable } from './RecordTable.js';

export function LeadTable({ leads, columns = FIXED_LEAD_COLUMNS, fields, view, onOpen, onSort }: {
  leads: readonly Lead[]; columns?: readonly LeadColumn[]; fields: readonly LeadField[]; view: ViewState; onOpen: (lead: Lead) => void; onSort?: (sort: Sort | null) => void;
}) {
  const schema = useMemo(() => leadSchema(fields, columns), [fields, columns]);
  const rows = useMemo(() => {
    const filtered = visibleRecords(leads, view, schema);
    const sorted = view.sort ? compareRecords(view.sort, schema) : null;
    if (sorted) return filtered.sort(sorted);
    const stageOrder = new Map(columns.map((column, index) => [column.id, index]));
    return filtered.sort((a, b) => (stageOrder.get(a.stage) ?? 999) - (stageOrder.get(b.stage) ?? 999) || a.position - b.position);
  }, [leads, view, schema, columns]);
  return <RecordTable records={rows} schema={schema} columns={['stage', ...view.cardFields]} onOpen={onOpen} sort={view.sort} onSort={onSort}
    renderCell={(lead, field) => field === 'stage' ? <ColumnPill name={columns.find((column) => column.id === lead.stage)?.name ?? lead.stage} color={columns.find((column) => column.id === lead.stage)?.color ?? 'gray'} />
      : field === 'assignee' ? lead.assignee?.name ?? '' : undefined} />;
}
