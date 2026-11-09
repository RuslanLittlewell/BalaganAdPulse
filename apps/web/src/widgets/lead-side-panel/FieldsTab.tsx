import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, Mail, Phone, Plus } from "lucide-react";
import { useCompanies, usePeople } from "@/entities/crm-record/index.js";
import {
  arrivalIso,
  calendarDay,
  readableNumber,
  useLeadFields,
  useLeads,
  type Lead,
  type LeadField,
  type LeadInput,
} from "@/entities/lead/index.js";
import { MemberAvatar, useClientMembers } from "@/entities/membership/index.js";
import {
  ChoiceEditor,
  ChoicesEditor,
  Chips,
  customValueProblem,
  DateEditor,
  isAmount,
  isWebAddress,
  LeadTags,
  NONE,
  normalizedAmount,
} from "@/features/lead-management/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button, InlineText, SearchableSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/index.js";

export interface FieldsTabProps {
  boardKey: string;
  lead: Lead;
  editable: boolean;
  save: (body: LeadInput) => Promise<boolean>;
  onCreateRecord?: (kind: 'companies' | 'people') => void;
}

type Save = FieldsTabProps["save"];

function Group({ title, children }: { title: MessageKey; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="flex flex-col border-b border-border pb-2 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          {t(title)}
          <ChevronDown aria-hidden className={cn("size-3 transition-transform", !open && "-rotate-90")} />
        </button>
      </h3>
      {open ? <ul id={id} className="flex flex-col">{children}</ul> : null}
    </section>
  );
}

function Row({ label, labelId, htmlFor, field, children }: { label: string; labelId: string; htmlFor?: string; field: string; children: ReactNode }) {
  return (
    <li data-field={field} className="grid min-h-8 grid-cols-[8rem_minmax(0,1fr)] items-center gap-2">
      <label id={labelId} htmlFor={htmlFor} className="truncate px-1 text-sm text-muted-foreground">{label}</label>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function Action({ href, label, icon: Icon, external = false }: { href: string; label: MessageKey; icon: typeof Phone; external?: boolean }) {
  return (
    <a
      href={href}
      aria-label={t(label)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon aria-hidden className="size-3" />
    </a>
  );
}

type TextKey = "service" | "source";

interface TextAction { href: (value: string) => string; label: MessageKey; icon: typeof Phone; external?: boolean }

function TextRow({ lead, field, label, editable, save, action }: {
  lead: Lead; field: TextKey; label: MessageKey; editable: boolean; save: Save; action?: TextAction;
}) {
  const labelId = useId();
  const value = lead[field] ?? "";
  const actionable = action && value;
  return (
    <Row label={t(label)} labelId={labelId} field={field}>
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1">
          <InlineText labelId={labelId} value={value} editable={editable} onSave={(next) => save({ [field]: next })} />
        </span>
        {actionable ? <Action href={action.href(value)} label={action.label} icon={action.icon} external={action.external} /> : null}
      </span>
    </Row>
  );
}

function LinkedRecordRow({ lead, kind, editable, save, onCreateRecord }: { lead: Lead; kind: "person" | "company"; editable: boolean; save: Save; onCreateRecord?: FieldsTabProps['onCreateRecord'] }) {
  const labelId = useId();
  const clientId = lead.project.clientId;
  const { data: people } = usePeople(clientId);
  const { data: companies } = useCompanies(clientId);
  const isPerson = kind === "person";
  const options = isPerson ? people ?? [] : companies ?? [];
  const current = isPerson ? lead.person : lead.company;
  const id = isPerson ? lead.personId : lead.companyId;
  const label = t(isPerson ? "crm.form.person" : "crm.form.company");
  return <Row label={label} labelId={labelId} field={kind}>
    <span className="flex items-center gap-1">
      {editable ? <>
        <SearchableSelect
          className="h-8 min-w-0 flex-1 border-transparent shadow-none hover:border-input"
          ariaLabel={label}
          value={id ?? NONE}
          onValueChange={(next) => void save(isPerson ? { personId: next === NONE ? null : next } : { companyId: next === NONE ? null : next })}
          pinned={[{ value: NONE, label: t("crm.panel.empty") }]}
          options={[
            ...(current && !options.some((record) => record.id === current.id) ? [{ value: current.id, label: current.name }] : []),
            ...options.map((record) => ({ value: record.id, label: record.name })),
          ]}
          searchLabel={t("select.search")}
          emptyLabel={t("select.search.empty")}
        />
        {onCreateRecord ? (
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`${t('crm.record.add')} ${label}`} onClick={() => onCreateRecord(isPerson ? 'people' : 'companies')}>
            <Plus aria-hidden className="size-3" />
          </Button>
        ) : null}
      </> : <span className="min-w-0 flex-1 truncate px-2 text-sm">{current?.name ?? t("crm.panel.empty")}</span>}
      {current ? <a aria-label={t("crm.record.open")} href={`/crm/${isPerson ? "people" : "companies"}?board=${encodeURIComponent(lead.projectId)}&record=${encodeURIComponent(current.id)}`} className="rounded-md p-1 hover:bg-muted"><ExternalLink aria-hidden className="size-3" /></a> : null}
    </span>
  </Row>;
}

function LinkedValueRow({ lead, field, editable, save, action }: { lead: Lead; field: "phone" | "email" | "telegram" | "messenger" | "website"; editable: boolean; save: Save; action?: TextAction }) {
  const labelId = useId();
  const value = field === "website" ? lead.company?.website ?? "" : lead.person?.[field] ?? "";
  const labels = { phone: "crm.card.phone", email: "crm.form.email", telegram: "crm.card.telegram", messenger: "crm.card.messenger", website: "crm.form.website" } as const;
  const limit = field === "website" ? 2048 : field === "email" ? 254 : field === "phone" ? 50 : 100;
  const problem = (next: string): MessageKey | null => field === "email" && next !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? "platform.form.emailInvalid"
    : field === "website" && next !== "" && !isWebAddress(next) ? "crm.card.custom.linkInvalid"
    : next.length > limit ? "crm.form.saveFailed" : null;
  return <Row label={t(labels[field])} labelId={labelId} field={field}><span className="flex min-w-0 items-center gap-1"><span className="min-w-0 flex-1">
    <InlineText labelId={labelId} value={value} editable={editable} inputMode={field === "phone" ? "tel" : field === "email" ? "email" : field === "website" ? "url" : "text"} validate={problem}
      onSave={(next) => save(field === "website" ? { organization: { website: next } } : { contact: { [field]: next } })} />
  </span>{action && value ? <Action href={action.href(value)} label={action.label} icon={action.icon} external={action.external} /> : null}</span></Row>;
}

function AmountRow({ lead, editable, save }: { lead: Lead; editable: boolean; save: Save }) {
  const labelId = useId();
  return (
    <Row label={t("crm.card.amount")} labelId={labelId} field="amount">
      <InlineText
        labelId={labelId}
        value={readableNumber(lead.amount)}
        inputMode="decimal"
        editable={editable}
        validate={(value) => (isAmount(value) ? null : "crm.card.amountInvalid")}
        normalize={(value) => normalizedAmount(value) || null}
        onSave={(amount) => save({ amount })}
      />
    </Row>
  );
}

function AssigneeRow({ lead, editable, save }: { lead: Lead; editable: boolean; save: Save }) {
  const labelId = useId();
  const { data: members } = useClientMembers(lead.project.clientId);
  const assignees = members?.filter((member) => member.status === "ACTIVE") ?? [];
  const missing = lead.assignee && !assignees.some((member) => member.id === lead.assigneeId) ? lead.assignee : null;
  return (
    <Row label={t("crm.form.assignee")} labelId={labelId} field="assignee">
      {editable ? (
        <Select value={lead.assigneeId ?? NONE} onValueChange={(value) => void save({ assigneeId: value === NONE ? null : value })}>
          <SelectTrigger aria-labelledby={labelId} className="h-8 w-full border-transparent shadow-none hover:border-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("crm.form.unassigned")}</SelectItem>
            {assignees.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                <span className="flex min-w-0 items-center gap-2"><MemberAvatar member={member} size="sm" /><span className="truncate">{member.name}</span></span>
              </SelectItem>
            ))}
            {missing ? <SelectItem value={missing.id}>{missing.name}</SelectItem> : null}
          </SelectContent>
        </Select>
      ) : (
        <span aria-labelledby={labelId} className="flex min-w-0 items-center gap-2 px-2 text-sm">
          {lead.assignee ? <><MemberAvatar member={lead.assignee} size="sm" /><span className="truncate">{lead.assignee.name}</span></> : t("crm.form.unassigned")}
        </span>
      )}
    </Row>
  );
}

function TagsRow({ boardKey, lead, editable, save }: { boardKey: string; lead: Lead; editable: boolean; save: Save }) {
  const labelId = useId();
  const { data: boardLeads } = useLeads(boardKey);
  const suggestions = useMemo(
    () => [...new Set((boardLeads ?? []).flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b, "ru")),
    [boardLeads],
  );
  return (
    <Row label={t("crm.card.tags")} labelId={labelId} field="tags">
      <div role="group" aria-labelledby={labelId} className="px-1">
        <LeadTags value={lead.tags} suggestions={suggestions} disabled={!editable} onChange={(tags) => void save({ tags })} />
      </div>
    </Row>
  );
}

function NotesRow({ lead, editable, save }: { lead: Lead; editable: boolean; save: Save }) {
  const labelId = useId();
  return (
    <li data-field="notes" className="flex flex-col">
      <span id={labelId} className="sr-only">{t("crm.panel.notes")}</span>
      <InlineText labelId={labelId} value={lead.notes ?? ""} multiline editable={editable} onSave={(notes) => save({ notes })} />
    </li>
  );
}

function SystemRow({ label, field, value }: { label: MessageKey; field: string; value: string }) {
  const labelId = useId();
  return (
    <Row label={t(label)} labelId={labelId} field={field}>
      <span aria-labelledby={labelId} className="px-2 text-sm">{value}</span>
    </Row>
  );
}

function CustomEditor({ field, lead, editable, labelId, save }: { field: LeadField; lead: Lead; editable: boolean; labelId: string; save: Save }) {
  const value = lead.customValues?.[field.id];
  const id = `panel-custom-${field.id}`;
  const store = (next: string | string[] | boolean | null) => {
    const empty = next === null || next === "" || next === false || (Array.isArray(next) && next.length === 0);
    return save({ customValues: { [field.id]: empty ? null : next } });
  };
  switch (field.type) {
    case "CHECKBOX":
      return (
        <span className="flex h-8 items-center px-2">
          <input id={id} type="checkbox" aria-labelledby={labelId} className="size-4 accent-primary" disabled={!editable} checked={value === true} onChange={(event) => void store(event.target.checked)} />
        </span>
      );
    case "DATE":
      return <DateEditor id={id} value={typeof value === "string" ? value : ""} editable={editable} onChange={(day) => void store(day)} />;
    case "SELECT":
      return editable
        ? <ChoiceEditor id={id} field={field} value={typeof value === "string" ? value : NONE} editable onChange={(choice) => void store(choice === NONE ? null : choice)} />
        : <span className="block px-2"><Chips field={field} chosen={typeof value === "string" ? [value] : []} /></span>;
    case "MULTI_SELECT":
      return <ChoicesEditor id={id} field={field} value={Array.isArray(value) ? value : []} editable={editable} onChange={(chosen) => void store(chosen)} />;
    case "NUMBER":
      return (
        <InlineText
          labelId={labelId}
          value={typeof value === "string" ? readableNumber(value) : ""}
          inputMode="decimal"
          editable={editable}
          validate={(entered) => customValueProblem(field, entered)}
          normalize={(entered) => normalizedAmount(entered) || null}
          onSave={(next) => store(next)}
        />
      );
    case "LINK": {
      const address = typeof value === "string" ? value : "";
      return (
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1">
            <InlineText labelId={labelId} value={address} inputMode="url" editable={editable} validate={(entered) => customValueProblem(field, entered)} onSave={(next) => store(next)} />
          </span>
          {address && isWebAddress(address) ? <Action href={address} label="crm.panel.openLink" icon={ExternalLink} external /> : null}
        </span>
      );
    }
    default:
      return <InlineText labelId={labelId} value={typeof value === "string" ? value : ""} editable={editable} validate={(entered) => customValueProblem(field, entered)} onSave={(next) => store(next)} />;
  }
}

function CustomRow({ field, lead, editable, save }: { field: LeadField; lead: Lead; editable: boolean; save: Save }) {
  const labelId = `panel-custom-${field.id}-label`;
  return (
    <Row label={field.name} labelId={labelId} htmlFor={`panel-custom-${field.id}`} field={`custom:${field.id}`}>
      <CustomEditor field={field} lead={lead} editable={editable} labelId={labelId} save={save} />
    </Row>
  );
}

export function FieldsTab({ boardKey, lead, editable, save, onCreateRecord }: FieldsTabProps) {
  const { data: fields } = useLeadFields(boardKey);
  const shared = { lead, editable, save };
  return (
    <div className="flex flex-col gap-3">
      <Group title="crm.panel.group.deal">
        <AmountRow {...shared} />
        <AssigneeRow {...shared} />
        <TagsRow boardKey={boardKey} {...shared} />
        <TextRow {...shared} field="service" label="crm.card.service" />
        <TextRow {...shared} field="source" label="crm.form.source" />
      </Group>

      <Group title="crm.panel.group.contacts">
        <LinkedRecordRow {...shared} kind="person" onCreateRecord={onCreateRecord} />
        <LinkedValueRow {...shared} field="phone" action={{ href: (value) => `tel:${value}`, label: "crm.panel.call", icon: Phone }} />
        <LinkedValueRow {...shared} field="telegram" />
        <LinkedValueRow {...shared} field="messenger" />
        <LinkedValueRow {...shared} field="email" action={{ href: (value) => `mailto:${value}`, label: "crm.panel.write", icon: Mail }} />
        <LinkedRecordRow {...shared} kind="company" onCreateRecord={onCreateRecord} />
        <LinkedValueRow {...shared} field="website" action={{ href: (value) => value, label: "crm.panel.openLink", icon: ExternalLink, external: true }} />
      </Group>

      {(fields ?? []).length > 0 ? (
        <Group title="crm.panel.group.custom">
          {(fields ?? []).map((field) => <CustomRow key={field.id} field={field} {...shared} />)}
        </Group>
      ) : null}

      <Group title="crm.panel.group.notes">
        <NotesRow {...shared} />
      </Group>

      <Group title="crm.panel.group.system">
        <SystemRow label="crm.view.field.arrival" field="arrival" value={calendarDay(arrivalIso(lead))} />
        <SystemRow label="crm.panel.origin" field="origin" value={t(`crm.panel.origin.${lead.origin}`)} />
      </Group>
    </div>
  );
}
