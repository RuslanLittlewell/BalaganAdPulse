import type { ReactNode } from 'react';
import { schemaField, type FieldRef, type RecordSchema, type SchemaField, type Sort } from '@/features/lead-view-options/index.js';
import { cn } from '@/shared/lib/index.js';
import { InlineText, SortButton, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/index.js';
import { t, type MessageKey } from '@/shared/config/index.js';

export interface RecordTableProps<T extends { id: string; name: string }> {
  records: readonly T[];
  schema: RecordSchema<T>;
  columns: readonly FieldRef[];
  onOpen: (record: T) => void;
  editable?: boolean;
  editableFields?: readonly FieldRef[];
  onEdit?: (record: T, field: FieldRef, value: string | null) => Promise<boolean>;
  validate?: (field: FieldRef, value: string) => MessageKey | null;
  renderCell?: (record: T, field: FieldRef) => ReactNode | undefined;
  sort?: Sort | null;
  onSort?: (sort: Sort | null) => void;
}

function shown<T>(record: T, field: SchemaField<T>): string {
  const value = field.value(record);
  if (value === null || value === false) return '';
  if (value === true) return '✓';
  if (Array.isArray(value)) return value.join(', ');
  if (field.kind === 'choice') return field.options.find((option) => option.id === value)?.name ?? value;
  if (field.kind === 'date' || field.kind === 'arrival') {
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}.${month}.${year}` : value;
  }
  return value;
}

const SOLID_MUTED = 'bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]';

function nextSort(current: Sort | null | undefined, field: FieldRef): Sort | null {
  if (current?.field !== field) return { field, direction: 'asc' };
  return current.direction === 'asc' ? { field, direction: 'desc' } : null;
}

const ariaSort = (current: Sort | null | undefined, field: FieldRef) =>
  current?.field === field ? (current.direction === 'asc' ? 'ascending' : 'descending') : undefined;

export function RecordTable<T extends { id: string; name: string }>({ records, schema, columns, onOpen, editable = false, editableFields, onEdit, validate, renderCell, sort, onSort }: RecordTableProps<T>) {
  const refs = ['name', ...columns.filter((field) => field !== 'name')] as FieldRef[];
  const fields = refs.flatMap((ref) => { const field = schemaField(schema, ref); return field ? [field] : []; });
  return <div className="max-h-full min-h-0 min-w-0 flex-1 self-start overflow-auto rounded-lg border border-border">
    <table data-slot="table" className="w-full min-w-max caption-bottom text-left text-sm">
      <TableHeader className="sticky top-0 z-20 [&_th]:backdrop-blur-xl">
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          {fields.map((field, index) => (
            <TableHead key={field.ref} scope="col" aria-sort={ariaSort(sort, field.ref)} className={cn('h-[24.5px] whitespace-nowrap px-2 py-0', index === 0 && 'sticky left-0 z-10')}>
              {onSort && field.sortable
                ? <SortButton label={field.label} direction={sort?.field === field.ref ? sort.direction : null} onSort={() => onSort(nextSort(sort, field.ref))} />
                : field.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => <TableRow key={record.id} className="group cursor-pointer" onClick={() => onOpen(record)}>
          {fields.map((field, index) => {
            const custom = renderCell?.(record, field.ref);
            const value = shown(record, field);
            const canEdit = editable && onEdit && index !== 0 && (!editableFields || editableFields.includes(field.ref)) && (field.kind === 'text' || field.kind === 'number' || field.kind === 'date');
            if (index === 0) {
              return <TableHead key={field.ref} scope="row" data-field={field.ref} className={cn('sticky left-0 z-10 max-w-72 min-w-44 overflow-hidden px-2 font-normal shadow-[inset_0_1px_0_var(--border)]', SOLID_MUTED)}>
                <button type="button" className="block w-full truncate rounded px-1 py-1 text-left font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring" onClick={(event) => { event.stopPropagation(); onOpen(record); }}>{record.name}</button>
              </TableHead>;
            }
            return <TableCell key={field.ref} data-field={field.ref} className="max-w-64 min-w-36 px-2 py-1" onClick={canEdit ? (event) => event.stopPropagation() : undefined}>
              {custom !== undefined ? custom
                : canEdit ? <><span id={`cell-${record.id}-${field.ref}`} className="sr-only">{field.label}</span><InlineText labelId={`cell-${record.id}-${field.ref}`} value={value} editable inputMode={field.ref === 'phone' ? 'tel' : field.ref === 'email' ? 'email' : field.ref === 'website' ? 'url' : 'text'} validate={(next) => validate?.(field.ref, next) ?? null} onSave={(next) => onEdit(record, field.ref, next)} /></>
                  : <span className="block truncate px-2 py-1" title={value}>{value || <span className="text-muted-foreground/60">{t('crm.panel.empty')}</span>}</span>}
            </TableCell>;
          })}
        </TableRow>)}
      </TableBody>
    </table>
  </div>;
}
