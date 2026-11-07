import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useCompanies, usePeople } from '@/entities/crm-record/index.js';
import { FIXED_LEAD_COLUMNS, leadColumnLabel, useCreateLead, useLeadColumns, useLeads, type CustomValue, type Lead, type LeadField, type LeadInput } from '@/entities/lead/index.js';
import { useClientMembers } from '@/entities/membership/index.js';
import { ChoiceEditor, ChoicesEditor, customValueProblem, DateEditor, isAmount, isWebAddress, LeadTags, NONE, normalizedAmount } from '@/features/lead-management/index.js';
import { t } from '@/shared/config/index.js';
import { ApiError } from '@/shared/lib/index.js';
import { Button, Label, SearchableSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SidePanel, useAlerts } from '@/shared/ui/index.js';

const inputClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring';
const value = (text: string) => text.trim() || null;
type Draft = { name: string; stage: string; amount: string; assigneeId: string; service: string; source: string; personId: string; companyId: string; phone: string; email: string; telegram: string; messenger: string; website: string; notes: string };
const blank = (stage: string): Draft => ({ name: '', stage, amount: '', assigneeId: '', service: '', source: '', personId: '', companyId: '', phone: '', email: '', telegram: '', messenger: '', website: '', notes: '' });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}
function PickerField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1 text-sm"><Label htmlFor={id} className="font-normal text-muted-foreground">{label}</Label>{children}</div>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3 border-b border-border pb-4"><h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>{children}</section>;
}

export function CreateLeadPanel({ boardKey, clientId, initialStage, fields, onCreated, onClose }: {
  boardKey: string; clientId: string; initialStage: string; fields: readonly LeadField[];
  onCreated: (lead: Lead) => void; onClose: () => void;
}) {
  const create = useCreateLead(boardKey);
  const { raise } = useAlerts();
  const { data: columns } = useLeadColumns(boardKey);
  const { data: people } = usePeople(clientId);
  const { data: companies } = useCompanies(clientId);
  const { data: members } = useClientMembers(clientId);
  const { data: leads } = useLeads(boardKey);
  const suggestions = useMemo(() => [...new Set((leads ?? []).flatMap((lead) => lead.tags))].sort((a, b) => a.localeCompare(b, 'ru')), [leads]);
  const [draft, setDraft] = useState<Draft>(() => blank(initialStage));
  const [tags, setTags] = useState<string[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, CustomValue>>({});
  const [problem, setProblem] = useState('');
  const ids = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus({ preventScroll: true }); }, []);
  const idOf = (name: string) => `${ids}-${name}`;
  useEffect(() => { setDraft((current) => (current.stage === initialStage ? current : { ...current, stage: initialStage })); }, [initialStage]);
  const pick = (next: string) => (next === NONE ? '' : next);
  const recordOptions = (records: readonly { id: string; name: string }[] | undefined) => (records ?? []).map((record) => ({ value: record.id, label: record.name }));
  const emptyOption = [{ value: NONE, label: t('crm.panel.empty') }];
  const set = (field: keyof Draft, next: string) => { setDraft((current) => ({ ...current, [field]: next })); setProblem(''); };
  const setCustom = (id: string, next: CustomValue | null) => {
    setCustomValues((current) => { const updated = { ...current }; if (next === null || next === '' || (Array.isArray(next) && !next.length)) delete updated[id]; else updated[id] = next; return updated; });
    setProblem('');
  };
  const textField = (field: keyof Draft, label: string, type = 'text') => <Field label={label}><input type={type} className={inputClass} value={draft[field]} onChange={(event) => set(field, event.target.value)} /></Field>;

  function customEditor(field: LeadField) {
    const current = customValues[field.id];
    const id = idOf(`custom-${field.id}`);
    if (field.type === 'CHECKBOX') return <span className="flex h-8 items-center"><input id={id} type="checkbox" className="size-4 accent-primary" checked={current === true} onChange={(event) => setCustom(field.id, event.target.checked ? true : null)} /></span>;
    if (field.type === 'SELECT') return <ChoiceEditor id={id} field={field} value={typeof current === 'string' ? current : NONE} editable onChange={(next) => setCustom(field.id, next === NONE ? null : next)} />;
    if (field.type === 'MULTI_SELECT') return <ChoicesEditor id={id} field={field} value={Array.isArray(current) ? current : []} editable onChange={(next) => setCustom(field.id, next)} />;
    if (field.type === 'DATE') return <DateEditor id={id} value={typeof current === 'string' ? current : ''} editable onChange={(next) => setCustom(field.id, next || null)} />;
    return <input id={id} type={field.type === 'LINK' ? 'url' : 'text'} inputMode={field.type === 'NUMBER' ? 'decimal' : undefined} className={inputClass} value={typeof current === 'string' ? current : ''} onChange={(event) => setCustom(field.id, event.target.value)} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    const name = draft.name.trim();
    if (!name || name.length > 200) { setProblem(t('crm.form.nameRequired')); return; }
    if (!isAmount(draft.amount)) { setProblem(t('crm.card.amountInvalid')); return; }
    if (draft.service.length > 200 || draft.source.length > 200 || draft.notes.length > 10000 || draft.phone.length > 50 || draft.telegram.length > 100 || draft.messenger.length > 100) { setProblem(t('crm.form.tooLong')); return; }
    const email = value(draft.email);
    const website = value(draft.website);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setProblem(t('platform.form.emailInvalid')); return; }
    if (website && (website.length > 2048 || !isWebAddress(website))) { setProblem(t('crm.card.custom.linkInvalid')); return; }
    for (const field of fields) {
      const entered = customValues[field.id];
      if (typeof entered === 'string') {
        const error = customValueProblem(field, entered);
        if (error) { setProblem(`${field.name}: ${t(error)}`); return; }
      }
    }
    const normalizedCustom = Object.fromEntries(Object.entries(customValues).filter(([, entered]) => typeof entered !== 'string' || entered.trim() !== '').map(([id, entered]) => {
      const field = fields.find((candidate) => candidate.id === id);
      return [id, field?.type === 'NUMBER' && typeof entered === 'string' ? normalizedAmount(entered) : entered];
    }));
    const body: LeadInput = {
      name, stage: draft.stage, amount: value(normalizedAmount(draft.amount)), assigneeId: draft.assigneeId || null,
      tags, service: value(draft.service), source: value(draft.source), notes: value(draft.notes), personId: draft.personId || null, companyId: draft.companyId || null,
      ...(value(draft.phone) || email || value(draft.telegram) || value(draft.messenger) ? { contact: { phone: value(draft.phone), email, telegram: value(draft.telegram), messenger: value(draft.messenger) } } : {}),
      ...(website ? { organization: { website } } : {}),
      ...(Object.keys(normalizedCustom).length ? { customValues: normalizedCustom } : {}),
    };
    try { const lead = await create.mutateAsync(body); raise(t('crm.created'), 'success'); onCreated(lead); }
    catch (error) { setProblem(error instanceof ApiError && error.status < 500 ? error.message : t('crm.form.saveFailed')); }
  }

  return <SidePanel label={t('crm.form.newLead')} testId="create-lead-panel" onClose={onClose}>
    <header className="flex items-center gap-2 border-b border-border px-4 py-3"><h2 className="min-w-0 flex-1 truncate text-base font-semibold">{t('crm.form.newLead')}</h2>
      <Button type="button" variant="ghost" size="icon" aria-label={t('crm.panel.close')} onClick={onClose}><X className="size-4" /></Button></header>
    <form noValidate onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Field label={t('crm.form.name')}><input ref={nameInput} required maxLength={200} className={inputClass} value={draft.name} onChange={(event) => set('name', event.target.value)} /></Field>
        <PickerField label={t('crm.form.stage')} id={idOf('stage')}>
          <Select value={draft.stage} onValueChange={(next) => set('stage', next)}>
            <SelectTrigger id={idOf('stage')} className="h-8 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{(columns ?? FIXED_LEAD_COLUMNS).map((column) => <SelectItem key={column.id} value={column.id}>{leadColumnLabel(column)}</SelectItem>)}</SelectContent>
          </Select>
        </PickerField>
        <Group title={t('crm.panel.group.deal')}>
          {textField('amount', t('crm.card.amount'))}
          <PickerField label={t('crm.form.assignee')} id={idOf('assignee')}>
            <Select value={draft.assigneeId || NONE} onValueChange={(next) => set('assigneeId', pick(next))}>
              <SelectTrigger id={idOf('assignee')} className="h-8 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('crm.form.unassigned')}</SelectItem>
                {(members ?? []).filter((member) => member.status === 'ACTIVE').map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </PickerField>
          <Field label={t('crm.card.tags')}><LeadTags value={tags} suggestions={suggestions} onChange={setTags} /></Field>
          {textField('service', t('crm.card.service'))}{textField('source', t('crm.form.source'))}
        </Group>
        <Group title={t('crm.panel.group.contacts')}>
          <PickerField label={t('crm.form.person')} id={idOf('person')}>
            <SearchableSelect id={idOf('person')} className="h-8" value={draft.personId || NONE} onValueChange={(next) => set('personId', pick(next))}
              pinned={emptyOption} options={recordOptions(people)} searchLabel={t('select.search')} emptyLabel={t('select.search.empty')} />
          </PickerField>
          {textField('phone', t('crm.card.phone'), 'tel')}{textField('email', t('crm.form.email'), 'email')}{textField('telegram', t('crm.card.telegram'))}{textField('messenger', t('crm.card.messenger'))}
          <PickerField label={t('crm.form.company')} id={idOf('company')}>
            <SearchableSelect id={idOf('company')} className="h-8" value={draft.companyId || NONE} onValueChange={(next) => set('companyId', pick(next))}
              pinned={emptyOption} options={recordOptions(companies)} searchLabel={t('select.search')} emptyLabel={t('select.search.empty')} />
          </PickerField>
          {textField('website', t('crm.form.website'), 'url')}
        </Group>
        {fields.length ? <Group title={t('crm.panel.group.custom')}>{fields.map((field) => <PickerField key={field.id} label={field.name} id={idOf(`custom-${field.id}`)}>{customEditor(field)}</PickerField>)}</Group> : null}
        <Group title={t('crm.panel.group.notes')}><Field label={t('crm.panel.notes')}><textarea rows={4} className={`${inputClass} h-auto min-h-24 py-2`} value={draft.notes} onChange={(event) => set('notes', event.target.value)} /></Field></Group>
      </div>
      {problem ? <p role="alert" className="px-4 py-2 text-sm text-destructive">{problem}</p> : null}
      <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><Button type="button" variant="outline" onClick={onClose}>{t('crm.form.cancel')}</Button><Button type="submit" disabled={create.isPending}>{t('crm.form.create')}</Button></footer>
    </form>
  </SidePanel>;
}
