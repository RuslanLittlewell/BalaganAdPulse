import { t } from "@/shared/config/index.js";
import type { Client } from "@/entities/client/index.js";

export type ContactKey =
  | "fullName"
  | "organization"
  | "unp"
  | "phone"
  | "telegram"
  | "email"
  | "website";

export interface ContactField {
  key: ContactKey;
  label: string;
  href?: (value: string) => string;
  inputMode?: "numeric" | "tel";
  type?: "email" | "tel";
}

function telegramHref(handle: string): string {
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://t.me/${handle.replace(/^@/, "")}`;
}

function websiteHref(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export const CONTACT_FIELDS: ContactField[] = [
  { key: "fullName", label: t("contacts.fullName") },
  { key: "organization", label: t("contacts.organization") },
  { key: "unp", label: t("contacts.unp"), inputMode: "numeric" },
  {
    key: "phone",
    label: t("contacts.phone"),
    type: "tel",
    href: (value) => `tel:${value.replace(/[^\d+]/g, "")}`,
  },
  { key: "telegram", label: t("contacts.telegram"), href: telegramHref },
  {
    key: "email",
    label: t("contacts.email"),
    type: "email",
    href: (value) => `mailto:${value}`,
  },
  { key: "website", label: t("contacts.website"), href: websiteHref },
];

export type ContactValues = { name: string } & Record<ContactKey, string>;

export function toValues(client?: Client): ContactValues {
  return {
    name: client?.name ?? "",
    fullName: client?.fullName ?? "",
    organization: client?.organization ?? "",
    unp: client?.unp ?? "",
    phone: client?.phone ?? "",
    telegram: client?.telegram ?? "",
    email: client?.email ?? "",
    website: client?.website ?? "",
  };
}
