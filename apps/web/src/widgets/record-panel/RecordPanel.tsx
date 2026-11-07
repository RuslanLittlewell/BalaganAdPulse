import { useId, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { useCompanies, useCompany, useDeleteCompany, useDeletePerson, usePerson, useUpdateCompany, useUpdatePerson, type CompanyInput, type PersonInput, type RelatedLead } from '@/entities/crm-record/index.js';
import { ColumnPill, type BoardCapabilities } from '@/entities/lead/index.js';
import { isWebAddress, NONE } from '@/features/lead-management/index.js';
import { t, type MessageKey } from '@/shared/config/index.js';
import { ApiError } from '@/shared/lib/index.js';
import { Button, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, InlineText, SearchableSelect, SidePanel, useAlerts } from '@/shared/ui/index.js';

export interface RecordPanelProps {
  kind: 'companies' | 'people';
  clientId: string;
  recordId: string;
  capabilities: BoardCapabilities;
  onClose: () => void;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-1 border-b border-border pb-4"><h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>{children}</section>;
}

function Row({ label, value, editable, onSave, validate, multiline = false }: { label: string; value: string | null; editable: boolean; onSave: (next: string | null) => Promise<boolean>; validate?: (next: string) => MessageKey | null; multiline?: boolean }) {
  const id = useId();
  return <div className="grid min-h-8 grid-cols-[8rem_minmax(0,1fr)] items-center gap-2"><span id={id} className="truncate text-sm text-muted-foreground">{label}</span><InlineText labelId={id} value={value ?? ''} editable={editable} multiline={multiline} validate={validate} onSave={onSave} /></div>;
}

function RelatedLeads({ leads }: { leads: readonly RelatedLead[] }) {
  return <Group title={t('crm.record.leads')}><ul className="flex flex-col gap-1">{leads.map((lead) => <li key={lead.id}>
    <Link className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted" to={`/crm?board=${encodeURIComponent(lead.board.key)}&lead=${encodeURIComponent(lead.id)}`}>
      <span className="min-w-0 flex-1 truncate">{lead.name}</span><ColumnPill name={lead.stage.name} color={lead.stage.color as Parameters<typeof ColumnPill>[0]['color']} /><span className="text-xs text-muted-foreground">{lead.board.label}</span>
    </Link>
  </li>)}</ul></Group>;
}

export function RecordPanel({ kind, clientId, recordId, capabilities, onClose }: RecordPanelProps) {
  const [params] = useSearchParams();
  const boardSuffix = params.get('board') ? `&board=${encodeURIComponent(params.get('board')!)}` : '';
  const isCompany = kind === 'companies';
  const { data: company } = useCompany(isCompany ? clientId : undefined, isCompany ? recordId : undefined);
  const { data: person } = usePerson(!isCompany ? clientId : undefined, !isCompany ? recordId : undefined);
  const { data: companies } = useCompanies(!isCompany ? clientId : undefined);
  const updateCompany = useUpdateCompany(clientId);
  const updatePerson = useUpdatePerson(clientId);
  const deleteCompany = useDeleteCompany(clientId);
  const deletePerson = useDeletePerson(clientId);
  const { raise } = useAlerts();
  const [confirming, setConfirming] = useState(false);
  const record = isCompany ? company : person;
  if (!record) return null;

  async function save(field: string, value: string | null): Promise<boolean> {
    try {
      if (isCompany) await updateCompany.mutateAsync({ id: recordId, body: { [field]: value } as CompanyInput });
      else await updatePerson.mutateAsync({ id: recordId, body: { [field]: value } as PersonInput });
      return true;
    } catch (error) {
      raise(error instanceof ApiError && error.status < 500 ? error.message : t('crm.form.saveFailed'));
      return false;
    }
  }

  async function remove() {
    try {
      if (isCompany) await deleteCompany.mutateAsync(recordId);
      else await deletePerson.mutateAsync(recordId);
      setConfirming(false);
      onClose();
    } catch {
      raise(t('crm.form.saveFailed'));
      setConfirming(false);
    }
  }

  const validName = (next: string): MessageKey | null => next.trim().length === 0 || next.length > 200 ? 'crm.form.nameRequired' : null;
  const validEmail = (next: string): MessageKey | null => next && (next.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) ? 'platform.form.emailInvalid' : null;
  const validWebsite = (next: string): MessageKey | null => next && (next.length > 2048 || !isWebAddress(next)) ? 'crm.card.custom.linkInvalid' : null;
  const validPhone = (next: string): MessageKey | null => next.length > 50 ? 'crm.form.saveFailed' : null;
  const validHandle = (next: string): MessageKey | null => next.length > 100 ? 'crm.form.saveFailed' : null;
  const validNotes = (next: string): MessageKey | null => next.length > 10000 ? 'crm.form.saveFailed' : null;

  return <SidePanel label={record.name} testId="record-side-panel" onClose={onClose}>
    <header className="flex items-center gap-2 border-b border-border px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{record.name}</span>
      {capabilities.delete ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={t('crm.record.actions')}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>{t('crm.delete')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
      <Button type="button" variant="ghost" size="icon" aria-label={t('crm.panel.close')} onClick={onClose}><X className="size-4" /></Button>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
      <Group title={t('crm.record.main')}>
        <Row label={t(isCompany ? 'crm.record.name' : 'crm.record.personName')} value={record.name} editable={capabilities.update} validate={validName} onSave={(next) => save('name', next)} />
        {isCompany && company ? <>
          <Row label={t('crm.form.website')} value={company.website} editable={capabilities.update} validate={validWebsite} onSave={(next) => save('website', next)} />
          <Row label={t('crm.card.phone')} value={company.phone} editable={capabilities.update} validate={validPhone} onSave={(next) => save('phone', next)} />
        </> : person ? <>
          <Row label={t('crm.card.phone')} value={person.phone} editable={capabilities.update} validate={validPhone} onSave={(next) => save('phone', next)} />
          <Row label={t('crm.form.email')} value={person.email} editable={capabilities.update} validate={validEmail} onSave={(next) => save('email', next)} />
          <Row label={t('crm.card.telegram')} value={person.telegram} editable={capabilities.update} validate={validHandle} onSave={(next) => save('telegram', next)} />
          <Row label={t('crm.card.messenger')} value={person.messenger} editable={capabilities.update} validate={validHandle} onSave={(next) => save('messenger', next)} />
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2 text-sm"><span className="text-muted-foreground">{t('crm.form.company')}</span>
            {capabilities.update ? (
              <SearchableSelect
                className="h-8 min-w-0 border-transparent shadow-none hover:border-input"
                ariaLabel={t('crm.form.company')}
                value={person.companyId ?? NONE}
                onValueChange={(next) => void save('companyId', next === NONE ? null : next)}
                pinned={[{ value: NONE, label: t('crm.panel.empty') }]}
                options={(companies ?? []).map((item) => ({ value: item.id, label: item.name }))}
                searchLabel={t('select.search')}
                emptyLabel={t('select.search.empty')}
              />
            ) : <span>{person.company?.name ?? t('crm.panel.empty')}</span>}
          </div>
        </> : null}
      </Group>
      <Group title={t('crm.record.notes')}><Row label={t('crm.record.notes')} value={record.notes} editable={capabilities.update} multiline validate={validNotes} onSave={(next) => save('notes', next)} /></Group>
      {isCompany && company ? <Group title={t('crm.record.people')}><ul>{company.people.map((related) => <li key={related.id}><Link className="block rounded-md px-2 py-1 text-sm hover:bg-muted" to={`/crm/people?record=${encodeURIComponent(related.id)}${boardSuffix}`}>{related.name}</Link></li>)}</ul></Group> : null}
      {!isCompany && person?.company ? <Group title={t('crm.form.company')}><Link className="rounded-md px-2 py-1 text-sm hover:bg-muted" to={`/crm/companies?record=${encodeURIComponent(person.company.id)}${boardSuffix}`}>{person.company.name}</Link></Group> : null}
      <RelatedLeads leads={isCompany ? company?.leads ?? [] : person?.leads ?? []} />
    </div>
    <ConfirmDialog open={confirming} title={t('crm.record.deleteTitle')} description={isCompany && company ? t('crm.record.deleteCompany').replace('{leads}', String(company.leadCount)).replace('{people}', String(company.peopleCount)) : t('crm.record.deletePerson').replace('{leads}', String(person?.leadCount ?? 0))} pending={deleteCompany.isPending || deletePerson.isPending} onConfirm={() => void remove()} onClose={() => setConfirming(false)} />
  </SidePanel>;
}
