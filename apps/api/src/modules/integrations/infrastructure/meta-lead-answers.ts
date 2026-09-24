import type { z } from "zod";
import { leadContactSchemas, type LeadAnswer } from "../../leads/index.js";

const MAX_ANSWERS = 100;
const MAX_ANSWER_TEXT = 10_000;

export interface FieldAnswer {
  name: string;
  values: readonly string[];
}

export interface MappedLeadAnswers {
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  answers: LeadAnswer[];
  answersOmitted: boolean;
}

function valid(schema: z.ZodType<string>, value: string | undefined): string | null {
  if (value === undefined) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const PHONE_SHAPE = /^[\d\s+().-]+$/;
const STANDARD_PHONE_QUESTIONS = ["phone_number", "work_phone_number"];

function mentionsPhone(question: string): boolean {
  return question.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((word) =>
    word.includes("phone") || word.includes("телефон") || word === "number"
    || (word.startsWith("tel") && !word.startsWith("telegram")));
}

function looksLikePhone(value: string): boolean {
  return PHONE_SHAPE.test(value) && (value.match(/\d/g) ?? []).length >= 5;
}

function customPhone(fieldData: readonly FieldAnswer[]): string | null {
  for (const field of fieldData) {
    if (STANDARD_PHONE_QUESTIONS.includes(field.name.toLowerCase()) || !mentionsPhone(field.name)) continue;
    for (const value of field.values) {
      const phone = valid(leadContactSchemas.phone, value.trim());
      if (phone && looksLikePhone(phone)) return phone;
    }
  }
  return null;
}

function keptAnswers(fieldData: readonly FieldAnswer[]) {
  const answers: LeadAnswer[] = [];
  let text = 0;
  for (const field of fieldData) {
    const length = field.values.reduce((sum, value) => sum + value.length, 0);
    if (answers.length === MAX_ANSWERS || text + length > MAX_ANSWER_TEXT) return { answers, answersOmitted: true };
    answers.push({ question: field.name, values: [...field.values] });
    text += length;
  }
  return { answers, answersOmitted: false };
}

export function mapLeadAnswers(externalId: string, fieldData: readonly FieldAnswer[]): MappedLeadAnswers {
  const answerTo = (key: string) => {
    for (const field of fieldData) {
      if (field.name.toLowerCase() !== key) continue;
      const value = field.values.map((item) => item.trim()).find((item) => item.length > 0);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const phone = valid(leadContactSchemas.phone, answerTo("phone_number"))
    ?? valid(leadContactSchemas.phone, answerTo("work_phone_number"))
    ?? customPhone(fieldData);
  const email = valid(leadContactSchemas.email, answerTo("email")) ?? valid(leadContactSchemas.email, answerTo("work_email"));
  const company = valid(leadContactSchemas.company, answerTo("company_name"));
  const joined = [answerTo("first_name"), answerTo("last_name")].filter((part) => part !== undefined).join(" ");
  const name = valid(leadContactSchemas.name, answerTo("full_name"))
    ?? valid(leadContactSchemas.name, joined || undefined)
    ?? phone ?? email ?? externalId;
  return { name, company, phone, email, ...keptAnswers(fieldData) };
}
