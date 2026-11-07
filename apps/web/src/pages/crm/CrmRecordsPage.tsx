import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCompanies, usePeople, useUpdateCompany, useUpdatePerson, type Company, type Person } from '@/entities/crm-record/index.js';
import { useCrmEvents, useLeadBoards, type BoardCapabilities } from '@/entities/lead/index.js';
import { useAuth } from '@/features/auth/index.js';
import { isWebAddress } from '@/features/lead-management/index.js';
import { companySchema, compareRecords, CrmViewChips, CrmViewControls, personSchema, pruneRecordState, useRecordViewState, visibleRecords, type FieldRef, type FilterContext, type RecordSchema } from '@/features/lead-view-options/index.js';
import { t, type MessageKey } from '@/shared/config/index.js';
import { ApiError, useModuleMemory } from '@/shared/lib/index.js';
import { Button, EmptyState, useAlerts } from '@/shared/ui/index.js';
import { CreateRecordPanel, RecordPanel } from '@/widgets/record-panel/index.js';
import { RecordTable } from '@/widgets/record-table/index.js';

type Kind = 'companies' | 'people';
type Named = { id: string; name: string };

function RecordsContent<T extends Named>({ kind, clientId, records, schema, capabilities, editableFields, onEdit }: {
  kind: Kind; clientId: string; records: readonly T[]; schema: RecordSchema<T>; capabilities: BoardCapabilities;
  editableFields: readonly FieldRef[];
  onEdit: (record: T, field: FieldRef, value: string | null) => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { view: stored, change } = useRecordViewState(user?.id, kind, clientId);
  const view = useMemo(() => pruneRecordState(stored, schema), [stored, schema]);
  const [freshFilter, setFreshFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { raise } = useAlerts();
  const context: FilterContext = { fields: [], catalogue: schema.fields, columns: [], assignees: [], tags: [] };
  const filtered = visibleRecords(records, view, schema);
  const comparator = view.sort ? compareRecords(view.sort, schema) : null;
  const shown = comparator ? [...filtered].sort(comparator) : filtered;
  const title = t(kind === 'companies' ? 'crm.nav.companies' : 'crm.nav.people');
  const recordId = params.get('record');

  function openId(id: string) {
    setAdding(false);
    setParams((current) => { const next = new URLSearchParams(current); next.set('record', id); return next; });
  }
  function open(record: T) { openId(record.id); }
  function close() {
    setParams((current) => { const next = new URLSearchParams(current); next.delete('record'); return next; });
  }
  async function edit(record: T, field: FieldRef, value: string | null) {
    try { await onEdit(record, field, value); return true; }
    catch (error) { raise(error instanceof ApiError && error.status < 500 ? error.message : t('crm.form.saveFailed')); return false; }
  }
  const validate = (field: FieldRef, value: string): MessageKey | null => {
    if (field === 'phone' && value.length > 50) return 'crm.form.saveFailed';
    if (field === 'email' && value && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return 'platform.form.emailInvalid';
    if (field === 'website' && value && (value.length > 2048 || !isWebAddress(value))) return 'crm.card.custom.linkInvalid';
    if ((field === 'telegram' || field === 'messenger') && value.length > 100) return 'crm.form.saveFailed';
    return null;
  };

  return <div className="flex h-full min-h-0 flex-col gap-2">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-2"><h1 className="mr-auto text-lg font-semibold">{title}</h1>
      <CrmViewControls view={view} context={context} columns canManageFields={false} onChange={change}
        onAddFilter={(filter) => { change({ filters: [...view.filters, filter] }); setFreshFilter(filter.id); }} />
      {capabilities.create ? <Button type="button" className="h-8 gap-1" onClick={() => { close(); setAdding(true); }}><Plus className="size-3" />{t('crm.record.add')}</Button> : null}
    </header>
    <CrmViewChips view={view} context={context} freshId={freshFilter} fields={[]} onChange={change} />
    <div className="relative flex min-h-0 flex-1 overflow-clip">
      <RecordTable records={shown} schema={schema} columns={view.cardFields} onOpen={open} editable={capabilities.update} editableFields={editableFields} onEdit={edit} validate={validate} sort={view.sort} onSort={(sort) => change({ sort })} />
      <AnimatePresence mode="wait">
        {recordId ? <RecordPanel key={`${kind}-record`} kind={kind} clientId={clientId} recordId={recordId} capabilities={capabilities} onClose={close} />
          : adding ? <CreateRecordPanel key={`new-${kind}`} kind={kind} clientId={clientId} onCreated={openId} onClose={() => setAdding(false)} /> : null}
      </AnimatePresence>
    </div>
  </div>;
}

export function CrmRecordsPage({ kind }: { kind: Kind }) {
  const { data: boards, isLoading } = useLeadBoards();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const remembered = useModuleMemory((state) => user ? state.boards[user.id] : undefined);
  const board = boards?.find((candidate) => candidate.key === params.get('board')) ?? boards?.find((candidate) => candidate.key === remembered) ?? boards?.[0];
  useCrmEvents(board?.key, {}, board?.clientId);
  if (isLoading) return null;
  if (!board) return <EmptyState title={t('crm.noBoards')} />;
  return kind === 'companies' ? <CompaniesContent key={board.clientId} clientId={board.clientId} capabilities={board.capabilities} /> : <PeopleContent key={board.clientId} clientId={board.clientId} capabilities={board.capabilities} />;
}

function CompaniesContent({ clientId, capabilities }: { clientId: string; capabilities: BoardCapabilities }) {
  const { data: companies } = useCompanies(clientId);
  const update = useUpdateCompany(clientId);
  const schema = useMemo(() => companySchema(), []);
  return <RecordsContent<Company> kind="companies" clientId={clientId} records={companies ?? []} schema={schema} capabilities={capabilities} editableFields={['website', 'phone']}
    onEdit={(record, field, value) => update.mutateAsync({ id: record.id, body: { [field]: value } })} />;
}

function PeopleContent({ clientId, capabilities }: { clientId: string; capabilities: BoardCapabilities }) {
  const { data: people } = usePeople(clientId);
  const { data: companies } = useCompanies(clientId);
  const update = useUpdatePerson(clientId);
  const schema = useMemo(() => personSchema(companies), [companies]);
  return <RecordsContent<Person> kind="people" clientId={clientId} records={people ?? []} schema={schema} capabilities={capabilities} editableFields={['phone', 'email', 'telegram', 'messenger']}
    onEdit={(record, field, value) => update.mutateAsync({ id: record.id, body: { [field]: value } })} />;
}
