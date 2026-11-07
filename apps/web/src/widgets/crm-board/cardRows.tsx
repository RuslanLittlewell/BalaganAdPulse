import type { ReactNode } from "react";
import {
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  CircleDot,
  Globe,
  Hash,
  Link as LinkIcon,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Radio,
  Send,
  Tag,
  Type,
  UserRound,
  ContactRound,
  type LucideIcon,
} from "lucide-react";
import { arrivalIso, calendarDay, OptionChip, readableNumber, type Lead, type LeadField } from "@/entities/lead/index.js";
import { MemberAvatar } from "@/entities/membership/index.js";
import { catalogueField, customIdOf, type BuiltInField, type FieldRef } from "@/features/lead-view-options/index.js";

const BUILT_IN_ICONS: Partial<Record<BuiltInField, LucideIcon>> = {
  amount: Banknote,
  assignee: UserRound,
  person: ContactRound,
  company: Building2,
  tags: Tag,
  service: Briefcase,
  phone: Phone,
  telegram: Send,
  messenger: MessageCircle,
  email: Mail,
  website: Globe,
  source: Radio,
  arrival: CalendarDays,
};

const CUSTOM_ICONS: Record<LeadField["type"], LucideIcon> = {
  TEXT: Type,
  NUMBER: Hash,
  DATE: CalendarDays,
  SELECT: CircleDot,
  MULTI_SELECT: ListChecks,
  CHECKBOX: CheckSquare,
  LINK: LinkIcon,
};

const stop = {
  onClick: (event: React.MouseEvent) => event.stopPropagation(),
  onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
};

const LINK_CLASS = "truncate hover:underline";

function External({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} {...stop}>{children}</a>;
}

function chips(field: LeadField, chosen: readonly string[]) {
  const picked = field.options.filter((option) => chosen.includes(option.id));
  if (picked.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {picked.map((option) => <OptionChip key={option.id} name={option.name} color={option.color} />)}
    </span>
  );
}

function customValue(lead: Lead, field: LeadField): ReactNode {
  const value = lead.customValues?.[field.id];
  if (value === undefined) return null;
  switch (field.type) {
    case "CHECKBOX": return value === true ? <CheckSquare aria-label={field.name} className="size-3" /> : null;
    case "SELECT": return typeof value === "string" ? chips(field, [value]) : null;
    case "MULTI_SELECT": return Array.isArray(value) ? chips(field, value) : null;
    case "NUMBER": return typeof value === "string" ? readableNumber(value) : null;
    case "DATE": return typeof value === "string" ? calendarDay(value) : null;
    case "LINK": return typeof value === "string" ? <External href={value}>{value}</External> : null;
    default: return typeof value === "string" ? <span className="truncate">{value}</span> : null;
  }
}

function builtInValue(lead: Lead, ref: BuiltInField): ReactNode {
  switch (ref) {
    case "amount": return lead.amount ? readableNumber(lead.amount) : null;
    case "assignee": return lead.assignee ? (
      <span className="flex min-w-0 items-center gap-1.5">
        <MemberAvatar member={lead.assignee} size="sm" />
        <span className="truncate">{lead.assignee.name}</span>
      </span>
    ) : null;
    case "tags": return lead.tags.length > 0 ? (
      <span className="flex min-w-0 flex-wrap gap-1">
        {lead.tags.map((tag) => <span key={tag} className="truncate rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium">{tag}</span>)}
      </span>
    ) : null;
    case "arrival": { const iso = arrivalIso(lead); return iso ? calendarDay(iso) : null; }
    case "phone": return lead.person?.phone ? <a href={`tel:${lead.person.phone}`} className={LINK_CLASS} {...stop}>{lead.person.phone}</a> : null;
    case "email": return lead.person?.email ? <a href={`mailto:${lead.person.email}`} className={LINK_CLASS} {...stop}>{lead.person.email}</a> : null;
    case "website": return lead.company?.website ? <External href={lead.company.website}>{lead.company.website}</External> : null;
    case "telegram": return lead.person?.telegram ? <span className="truncate">{lead.person.telegram}</span> : null;
    case "person": return lead.person ? <span className="truncate">{lead.person.name}</span> : null;
    case "company": return lead.company ? <span className="truncate">{lead.company.name}</span> : null;
    case "messenger": return lead.person?.messenger ? <span className="truncate">{lead.person.messenger}</span> : null;
    case "source": return lead.source ? <span className="truncate">{lead.source}</span> : null;
    case "service": return lead.service ? <span className="truncate">{lead.service}</span> : null;
    default: return null;
  }
}

export interface CardRow {
  ref: FieldRef;
  label: string;
  icon: LucideIcon;
  value: ReactNode;
}

export function cardRows(lead: Lead, refs: readonly FieldRef[], fields: readonly LeadField[]): CardRow[] {
  return refs.flatMap((ref) => {
    const entry = catalogueField(ref, fields);
    if (!entry || !entry.cardable) return [];
    const customId = customIdOf(ref);
    const custom = customId === null ? null : fields.find((field) => field.id === customId) ?? null;
    const value = custom ? customValue(lead, custom) : builtInValue(lead, ref as BuiltInField);
    if (value === null || value === "") return [];
    const icon = custom ? CUSTOM_ICONS[custom.type] : BUILT_IN_ICONS[ref as BuiltInField] ?? Type;
    return [{ ref, label: entry.label, icon, value }];
  });
}
