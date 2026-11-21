export const SYNC_KINDS = ["COMPANY", "PERSON", "LEAD", "NOTE", "TASK", "COMMENT"] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

export const EVENT_KINDS: Readonly<Record<string, SyncKind>> = {
  ONCRMLEADADD: "LEAD",
  ONCRMLEADUPDATE: "LEAD",
  ONCRMCONTACTADD: "PERSON",
  ONCRMCONTACTUPDATE: "PERSON",
  ONCRMCOMPANYADD: "COMPANY",
  ONCRMCOMPANYUPDATE: "COMPANY",
  ONTASKADD: "TASK",
  ONTASKUPDATE: "TASK",
  ONCRMTIMELINECOMMENTADD: "NOTE",
  ONCRMTIMELINECOMMENTUPDATE: "NOTE",
  ONTASKCOMMENTADD: "COMMENT",
  ONTASKCOMMENTUPDATE: "COMMENT",
};

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result === "" ? null : result;
};

const pick = (raw: Raw, ...names: string[]): unknown => {
  for (const name of names) if (raw[name] !== undefined) return raw[name];
  return undefined;
};

const date = (value: unknown): Date | null => {
  const source = text(value);
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const firstValue = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const first = value.find((item): item is Raw => typeof item === "object" && item !== null && text((item as Raw).VALUE) !== null);
  return first ? text(first.VALUE) : null;
};

const id = (value: unknown): string | null => {
  const result = text(value);
  return result && result !== "0" ? result : null;
};

export interface RemoteLead {
  id: string;
  title: string;
  statusId: string | null;
  amount: string | null;
  source: string | null;
  notes: string | null;
  contactId: string | null;
  companyId: string | null;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

export function parseRemoteLead(raw: Raw): RemoteLead {
  const opportunity = Number(text(raw.OPPORTUNITY) ?? "0");
  return {
    id: String(raw.ID),
    title: text(raw.TITLE) ?? "Без названия",
    statusId: text(raw.STATUS_ID),
    amount: Number.isFinite(opportunity) && opportunity > 0 ? opportunity.toFixed(2) : null,
    source: text(raw.SOURCE_DESCRIPTION),
    notes: text(raw.COMMENTS),
    contactId: id(raw.CONTACT_ID),
    companyId: id(raw.COMPANY_ID),
    createdAt: date(raw.DATE_CREATE),
    modifiedAt: date(raw.DATE_MODIFY),
  };
}

export interface LocalLeadFields {
  name: string;
  amount: string | null;
  source: string | null;
  notes: string | null;
}

export function leadToRemote(
  lead: LocalLeadFields,
  links: { statusId: string | null; contactId: string | null; companyId: string | null },
): Raw {
  const fields: Raw = {
    TITLE: lead.name,
    OPPORTUNITY: lead.amount === null ? "0" : String(Number(lead.amount)),
    SOURCE_DESCRIPTION: lead.source ?? "",
    COMMENTS: lead.notes ?? "",
  };
  if (links.statusId) fields.STATUS_ID = links.statusId;
  if (links.contactId) fields.CONTACT_ID = links.contactId;
  if (links.companyId) fields.COMPANY_ID = links.companyId;
  return fields;
}

export interface RemoteContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  companyId: string | null;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

export function parseRemoteContact(raw: Raw): RemoteContact {
  const name = [text(raw.NAME), text(raw.LAST_NAME)].filter(Boolean).join(" ");
  return {
    id: String(raw.ID),
    name: name || "Без имени",
    phone: firstValue(raw.PHONE),
    email: firstValue(raw.EMAIL),
    companyId: id(raw.COMPANY_ID),
    createdAt: date(raw.DATE_CREATE),
    modifiedAt: date(raw.DATE_MODIFY),
  };
}

export function contactToRemote(person: { name: string; phone: string | null; email: string | null }, companyId: string | null): Raw {
  const fields: Raw = {
    NAME: person.name,
    LAST_NAME: "",
    PHONE: person.phone ? [{ VALUE: person.phone, VALUE_TYPE: "WORK" }] : [],
    EMAIL: person.email ? [{ VALUE: person.email, VALUE_TYPE: "WORK" }] : [],
  };
  if (companyId) fields.COMPANY_ID = companyId;
  return fields;
}

export interface RemoteCompany {
  id: string;
  title: string;
  phone: string | null;
  website: string | null;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

export function parseRemoteCompany(raw: Raw): RemoteCompany {
  return {
    id: String(raw.ID),
    title: text(raw.TITLE) ?? "Без названия",
    phone: firstValue(raw.PHONE),
    website: firstValue(raw.WEB),
    createdAt: date(raw.DATE_CREATE),
    modifiedAt: date(raw.DATE_MODIFY),
  };
}

export function companyToRemote(company: { name: string; phone: string | null; website: string | null }): Raw {
  return {
    TITLE: company.name,
    PHONE: company.phone ? [{ VALUE: company.phone, VALUE_TYPE: "WORK" }] : [],
    WEB: company.website ? [{ VALUE: company.website, VALUE_TYPE: "WORK" }] : [],
  };
}

export interface RemoteTask {
  id: string;
  title: string;
  description: string | null;
  deadline: Date | null;
  done: boolean;
  responsibleId: string | null;
  leadRemoteId: string | null;
  modifiedAt: Date | null;
}

export function parseRemoteTask(raw: Raw): RemoteTask {
  const binding = pick(raw, "ufCrmTask", "UF_CRM_TASK");
  const bound = (Array.isArray(binding) ? binding : []).map(String).find((entry) => entry.startsWith("L_"));
  return {
    id: String(pick(raw, "id", "ID")),
    title: text(pick(raw, "title", "TITLE")) ?? "Без названия",
    description: text(pick(raw, "description", "DESCRIPTION")),
    deadline: date(pick(raw, "deadline", "DEADLINE")),
    done: String(pick(raw, "status", "STATUS")) === "5",
    responsibleId: id(pick(raw, "responsibleId", "RESPONSIBLE_ID")),
    leadRemoteId: bound ? bound.slice(2) : null,
    modifiedAt: date(pick(raw, "changedDate", "CHANGED_DATE")),
  };
}

export function taskToRemote(
  task: { title: string; description: string | null; dueDate: Date | null },
  leadRemoteId: string,
  responsibleId: string | null,
): Raw {
  const fields: Raw = {
    TITLE: task.title,
    DESCRIPTION: task.description ?? "",
    DEADLINE: task.dueDate ? task.dueDate.toISOString() : "",
    UF_CRM_TASK: [`L_${leadRemoteId}`],
  };
  if (responsibleId) fields.RESPONSIBLE_ID = responsibleId;
  return fields;
}

export function plainTextOf(description: unknown): string | null {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node === null || typeof node !== "object") return;
    const record = node as Raw;
    if (record.type === "text" && typeof record.text === "string") parts.push(record.text);
    if (Array.isArray(record.content)) {
      record.content.forEach(walk);
      if (record.type === "paragraph" || record.type === "heading") parts.push("\n");
    }
  };
  walk(description);
  const joined = parts.join("").trim();
  return joined === "" ? null : joined;
}

export function documentOf(plain: string): unknown {
  return {
    type: "doc",
    content: plain.split("\n").map((line) => (line === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}

export function noteToComment(authorName: string | null, body: string): string {
  return authorName ? `${authorName}: ${body}` : body;
}

export const REMOTE_AUTHOR_PREFIX = "Битрикс24: ";
