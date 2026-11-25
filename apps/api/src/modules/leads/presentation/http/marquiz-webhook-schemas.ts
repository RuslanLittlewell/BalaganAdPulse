import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LeadAnswer } from '#modules/leads/domain/lead.js';
import type { WebsiteLead } from '#modules/leads/domain/website-intake.js';

export const MARQUIZ_QUIZ_QUESTION = 'Квиз';
const PAIR_LIMIT = 50;
const ANSWER_SCAN_LIMIT = 500;

export const marquizWebhookSchema = z.object({
  contacts: z.unknown().optional(),
  answers: z.unknown().optional(),
  quiz: z.unknown().optional(),
  created: z.unknown().optional(),
  extra: z.unknown().optional(),
});

export type MarquizWebhookBody = z.infer<typeof marquizWebhookSchema>;

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cut(value: unknown, limit: number): string | null {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return text === '' ? null : text.slice(0, limit);
}

function questionOf(value: unknown): string | null {
  const text = cut(value, 2000)?.replace(/\s*\*+$/, '').trim();
  return text ? text.slice(0, 200) : null;
}

function optionsOf(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((option) => cut(option, 2000))
    .filter((option): option is string => option !== null);
}

function pairsOf(value: unknown): { q: unknown; a: unknown }[] {
  if (Array.isArray(value)) return value.slice(0, ANSWER_SCAN_LIMIT).map((item) => ({ q: recordOf(item).q, a: recordOf(item).a }));
  return Object.entries(recordOf(value)).slice(0, ANSWER_SCAN_LIMIT).map(([q, a]) => ({ q, a }));
}

function submissionIdOf(parts: unknown[]): string {
  return `marquiz-${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}

export function marquizLeadOf(body: MarquizWebhookBody): WebsiteLead | null {
  const contacts = recordOf(body.contacts);
  const quiz = recordOf(body.quiz);
  const extra = recordOf(body.extra);
  const utm = recordOf(extra.utm);
  const name = cut(contacts.name, 200);
  const phone = cut(contacts.phone, 50);
  const email = cut(contacts.email, 200);
  const answered: LeadAnswer[] = pairsOf(body.answers).flatMap(({ q, a }) => {
    const question = questionOf(q);
    const values = optionsOf(a);
    return question && values.length > 0 ? [{ question, values }] : [];
  });
  if (!name && !phone && !email && answered.length === 0) return null;

  const quizName = cut(quiz.name, 2000);
  const answers = quizName
    ? [...answered.slice(0, PAIR_LIMIT - 1), { question: MARQUIZ_QUIZ_QUESTION, values: [quizName] }]
    : answered.slice(0, PAIR_LIMIT);

  return {
    externalId: submissionIdOf([cut(quiz.id, 200), cut(body.created, 200), name, phone, email, answered]),
    name,
    company: null,
    phone,
    email,
    utmSource: cut(utm.source, 300),
    utmMedium: cut(utm.medium, 300),
    utmCampaign: cut(utm.campaign, 300) ?? cut(utm.name, 300),
    utmContent: cut(utm.content, 300),
    utmTerm: cut(utm.term, 300),
    pageUrl: cut(extra.href, 2048),
    referrer: cut(extra.referrer, 2048),
    answers,
  };
}
