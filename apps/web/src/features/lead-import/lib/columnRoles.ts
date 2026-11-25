import type { ImportRow, ImportTable } from "../api/api.js";

export const SINGLE_ROLES = [
  "name", "phone", "email", "submittedAt", "campaign", "status",
  "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "pageUrl", "referrer",
] as const;
export type SingleRole = (typeof SINGLE_ROLES)[number];
export type ColumnRole = SingleRole | "answer" | "skip";
export const COLUMN_ROLES: readonly ColumnRole[] = [...SINGLE_ROLES, "answer", "skip"];

const NAMES: Readonly<Record<SingleRole, readonly string[]>> = {
  name: ["name", "full_name", "fullname", "first_name", "contact_name", "client_name", "имя", "фио", "имя_клиента", "клиент", "контакт"],
  phone: ["phone", "phone_number", "tel", "telephone", "mobile", "телефон", "номер_телефона", "тел"],
  email: ["email", "e_mail", "mail", "почта", "электронная_почта"],
  submittedAt: ["dt_created", "created_time", "created_at", "created", "submitted_at", "date", "datetime", "timestamp", "time", "дата_заявки", "дата_создания", "дата", "время"],
  campaign: ["campaign_id", "utm_id", "campaign", "campaign_name", "id_кампании", "кампания", "рекламная_кампания"],
  status: ["status", "lead_status", "stage", "статус", "этап", "стадия"],
  utmSource: ["utm_source"],
  utmMedium: ["utm_medium"],
  utmCampaign: ["utm_campaign"],
  utmContent: ["utm_content"],
  utmTerm: ["utm_term"],
  pageUrl: ["href", "page_url", "url", "page", "страница", "адрес_страницы"],
  referrer: ["referrer", "referer", "источник_перехода"],
};

const TECHNICAL = new Set([
  "_fbc", "_fbp", "fbclid", "gclid", "yclid", "ysclid", "useragent", "user_agent", "ip", "ip_address", "fingerprint",
  "accesschannel", "lng", "lang", "currency", "notify", "timezone", "paymentenabled",
]);

const keyOf = (column: string) => column.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function proposeRoles(columns: readonly string[]): ColumnRole[] {
  const keys = columns.map(keyOf);
  const roles: ColumnRole[] = keys.map((key) => (key === "" || TECHNICAL.has(key) || key.startsWith("consent") ? "skip" : "answer"));
  for (const role of SINGLE_ROLES) {
    for (const name of NAMES[role]) {
      const index = keys.findIndex((key, position) => key === name && roles[position] === "answer");
      if (index >= 0) {
        roles[index] = role;
        break;
      }
    }
  }
  return roles;
}

export function assignRole(roles: readonly ColumnRole[], index: number, role: ColumnRole): ColumnRole[] {
  const single = (SINGLE_ROLES as readonly ColumnRole[]).includes(role);
  return roles.map((current, position) => (position === index ? role : single && current === role ? "skip" : current));
}

export function questionOf(columns: readonly string[], index: number): string {
  return columns[index]?.trim() || `#${index + 1}`;
}

export function rowsOf(table: ImportTable, roles: readonly ColumnRole[]): ImportRow[] {
  const cellOf = (row: readonly string[], role: SingleRole) => {
    const index = roles.indexOf(role);
    const value = index >= 0 ? row[index]?.trim() : "";
    return value ? value : null;
  };
  return table.rows.map((row) => ({
    name: cellOf(row, "name"),
    phone: cellOf(row, "phone"),
    email: cellOf(row, "email"),
    submittedAt: cellOf(row, "submittedAt"),
    campaign: cellOf(row, "campaign"),
    status: cellOf(row, "status"),
    utmSource: cellOf(row, "utmSource"),
    utmMedium: cellOf(row, "utmMedium"),
    utmCampaign: cellOf(row, "utmCampaign"),
    utmContent: cellOf(row, "utmContent"),
    utmTerm: cellOf(row, "utmTerm"),
    pageUrl: cellOf(row, "pageUrl"),
    referrer: cellOf(row, "referrer"),
    answers: roles.flatMap((role, index) => {
      const value = row[index]?.trim();
      return role === "answer" && value ? [{ question: questionOf(table.columns, index), values: [value] }] : [];
    }),
  }));
}

export function sampleOf(table: ImportTable, index: number): string {
  return table.rows.find((row) => row[index]?.trim())?.[index]?.trim() ?? "";
}
