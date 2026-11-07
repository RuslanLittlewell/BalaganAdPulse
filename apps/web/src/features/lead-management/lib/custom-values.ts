import type { LeadField } from "@/entities/lead/index.js";
import type { MessageKey } from "@/shared/config/index.js";
import { normalizedAmount } from "./card-values.js";

const NUMBER = /^-?\d{1,14}(\.\d{1,4})?$/;
const TEXT_LIMIT = 2000;
const LINK_LIMIT = 2048;

export function isWebAddress(value: string): boolean {
  if (!URL.canParse(value)) return false;
  return ["http:", "https:"].includes(new URL(value).protocol);
}

export function customValueProblem(field: LeadField, value: unknown): MessageKey | null {
  if (typeof value !== "string") return null;
  const entered = value.trim();
  if (entered === "") return null;
  if (field.type === "NUMBER" && !NUMBER.test(normalizedAmount(entered))) return "crm.card.custom.numberInvalid";
  if (field.type === "LINK" && (entered.length > LINK_LIMIT || !isWebAddress(entered))) return "crm.card.custom.linkInvalid";
  if (field.type === "TEXT" && entered.length > TEXT_LIMIT) return "crm.card.custom.textTooLong";
  return null;
}

export { calendarDay } from "@/entities/lead/index.js";
