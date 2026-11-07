import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useCompanies, useCreateCompany, useCreatePerson } from '@/entities/crm-record/index.js';
import { isWebAddress, NONE } from '@/features/lead-management/index.js';
import { t } from '@/shared/config/index.js';
import { ApiError } from '@/shared/lib/index.js';
import { Button, Label, SearchableSelect, SidePanel } from '@/shared/ui/index.js';

type Kind = 'companies' | 'people';
type Draft = { name: string; website: string; phone: string; email: string; telegram: string; messenger: string; companyId: string; notes: string };
const EMPTY: Draft = { name: '', website: '', phone: '', email: '', telegram: '', messenger: '', companyId: '', notes: '' };
const value = (text: string) => text.trim() || null;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

const inputClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring';

export function CreateRecordPanel({ kind, clientId, onCreated, onClose }: {
  kind: Kind; clientId: string; onCreated: (id: string) => void; onClose: () => void;
}) {
  const isCompany = kind === 'companies';
  const { data: companies } = useCompanies(isCompany ? undefined : clientId);
  const createCompany = useCreateCompany(clientId);
  const createPerson = useCreatePerson(clientId);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState('');
  const pending = createCompany.isPending || createPerson.isPending;
  const set = (field: keyof Draft, next: string) => { setDraft((current) => ({ ...current, [field]: next })); setProblem(''); };
  const companyId = `${useId()}-company`;
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus({ preventScroll: true }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const name = draft.name.trim();
    if (!name || name.length > 200) { setProblem(t('crm.form.nameRequired')); return; }
    if (draft.phone.length > 50 || draft.notes.length > 10000 || draft.telegram.length > 100 || draft.messenger.length > 100) { setProblem(t('crm.form.tooLong')); return; }
    const website = value(draft.website);
    const email = value(draft.email);
    if (isCompany && website && (website.length > 2048 || !isWebAddress(website))) { setProblem(t('crm.card.custom.linkInvalid')); return; }
    if (!isCompany && email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setProblem(t('platform.form.emailInvalid')); return; }
    try {
      const created = isCompany
        ? await createCompany.mutateAsync({ name, website, phone: value(draft.phone), notes: value(draft.notes) })
        : await createPerson.mutateAsync({ name, phone: value(draft.phone), email, telegram: value(draft.telegram), messenger: value(draft.messenger), companyId: draft.companyId || null, notes: value(draft.notes) });
      onCreated(created.id);
    } catch (error) {
      setProblem(error instanceof ApiError && error.status < 500 ? error.message : t('crm.form.recordSaveFailed'));
    }
  }

  const label = t(isCompany ? 'crm.form.newCompany' : 'crm.form.newPerson');
  return <SidePanel label={label} testId="create-record-panel" onClose={onClose}>
    <header className="flex items-center gap-2 border-b border-border px-4 py-3"><h2 className="min-w-0 flex-1 truncate text-base font-semibold">{label}</h2>
      <Button type="button" variant="ghost" size="icon" aria-label={t('crm.panel.close')} onClick={onClose}><X className="size-4" /></Button>
    </header>
    <form noValidate onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Field label={t(isCompany ? 'crm.record.name' : 'crm.record.personName')}><input ref={nameInput} required maxLength={200} className={inputClass} value={draft.name} onChange={(event) => set('name', event.target.value)} /></Field>
        {!isCompany ? (
          <div className="flex flex-col gap-1 text-sm">
            <Label htmlFor={companyId} className="font-normal text-muted-foreground">{t('crm.form.company')}</Label>
            <SearchableSelect
              id={companyId}
              className="h-8"
              value={draft.companyId || NONE}
              onValueChange={(next) => set('companyId', next === NONE ? '' : next)}
              pinned={[{ value: NONE, label: t('crm.panel.empty') }]}
              options={(companies ?? []).map((company) => ({ value: company.id, label: company.name }))}
              searchLabel={t('select.search')}
              emptyLabel={t('select.search.empty')}
            />
          </div>
        ) : null}
        {isCompany ? <Field label={t('crm.form.website')}><input type="url" className={inputClass} value={draft.website} onChange={(event) => set('website', event.target.value)} /></Field> : null}
        <Field label={t('crm.card.phone')}><input type="tel" className={inputClass} value={draft.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
        {!isCompany ? <>
          <Field label={t('crm.form.email')}><input type="email" className={inputClass} value={draft.email} onChange={(event) => set('email', event.target.value)} /></Field>
          <Field label={t('crm.card.telegram')}><input className={inputClass} value={draft.telegram} onChange={(event) => set('telegram', event.target.value)} /></Field>
          <Field label={t('crm.card.messenger')}><input className={inputClass} value={draft.messenger} onChange={(event) => set('messenger', event.target.value)} /></Field>
        </> : null}
        <Field label={t('crm.record.notes')}><textarea rows={4} className={`${inputClass} h-auto min-h-24 py-2`} value={draft.notes} onChange={(event) => set('notes', event.target.value)} /></Field>
      </div>
      {problem ? <p role="alert" className="px-4 py-2 text-sm text-destructive">{problem}</p> : null}
      <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><Button type="button" variant="outline" onClick={onClose}>{t('crm.form.cancel')}</Button><Button type="submit" disabled={pending}>{t('crm.form.create')}</Button></footer>
    </form>
  </SidePanel>;
}
