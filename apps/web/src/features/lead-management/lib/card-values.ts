import type { Lead, LeadInput } from "@/entities/lead/index.js";

export const NONE = "__none__";

const AMOUNT = /^\d{1,14}(\.\d{1,4})?$/;

export interface CardValues {
  name: string;
  stage: string;
  amount: string;
  assigneeId: string;
  company: string;
  tags: string[];
  service: string;
  phone: string;
  telegram: string;
  messenger: string;
  email: string;
  website: string;
  source: string;
  notes: string;
}

export function readableAmount(amount: string | null): string {
  if (!amount) return "";
  return amount.includes(".") ? amount.replace(/0+$/, "").replace(/\.$/, "") : amount;
}

export function normalizedAmount(entered: string): string {
  return entered.replace(/[\s ]/g, "").replace(",", ".");
}

export function isAmount(entered: string): boolean {
  const amount = normalizedAmount(entered);
  return amount === "" || AMOUNT.test(amount);
}

export const valuesOf = (lead?: Lead): CardValues => ({
  name: lead?.name ?? "",
  stage: lead?.stage ?? "NEW",
  amount: readableAmount(lead?.amount ?? null),
  assigneeId: lead?.assigneeId ?? NONE,
  company: lead?.company ?? "",
  tags: lead?.tags ?? [],
  service: lead?.service ?? "",
  phone: lead?.phone ?? "",
  telegram: lead?.telegram ?? "",
  messenger: lead?.messenger ?? "",
  email: lead?.email ?? "",
  website: lead?.website ?? "",
  source: lead?.source ?? "",
  notes: lead?.notes ?? "",
});

const text = (value: string) => value.trim() || null;
const choice = (value: string) => (value === NONE ? null : value);

export const bodyOf = (values: CardValues): LeadInput => ({
  name: values.name.trim(),
  amount: normalizedAmount(values.amount) || null,
  assigneeId: choice(values.assigneeId),
  company: text(values.company),
  tags: values.tags,
  service: text(values.service),
  phone: text(values.phone),
  telegram: text(values.telegram),
  messenger: text(values.messenger),
  email: text(values.email),
  website: text(values.website),
  source: text(values.source),
  notes: text(values.notes),
});
