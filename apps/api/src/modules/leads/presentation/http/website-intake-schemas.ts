import { z } from 'zod';
import type { LeadAnswer } from '#modules/leads/domain/lead.js';
import { WEBSITE_SITE_LIMIT, type WebsiteLead } from '#modules/leads/domain/website-intake.js';

const text = (limit: number) => z.string().trim().max(limit).transform((value) => (value === '' ? null : value)).nullish().transform((value) => value ?? null);

export const websiteLeadSchema = z.object({
  key: z.string().max(200).optional(),
  id: z.string().trim().min(1).max(100).optional(),
  name: text(200),
  phone: text(50),
  email: text(200),
  company: text(200),
  utm_source: text(300),
  utm_medium: text(300),
  utm_campaign: text(300),
  utm_content: text(300),
  utm_term: text(300),
  page_url: text(2048),
  referrer: text(2048),
  hp: z.string().max(200).optional(),
  fields: z.array(z.object({ question: z.string().trim().min(1).max(200), value: z.string().trim().min(1).max(2000) })).max(50).default([]),
});

export type WebsiteLeadBody = z.infer<typeof websiteLeadSchema>;

export function websiteLeadOf(body: WebsiteLeadBody, externalId: string): WebsiteLead {
  const answers: LeadAnswer[] = body.fields.map(({ question, value }) => ({ question, values: [value] }));
  return {
    externalId, name: body.name, company: body.company, phone: body.phone, email: body.email,
    utmSource: body.utm_source, utmMedium: body.utm_medium, utmCampaign: body.utm_campaign, utmContent: body.utm_content, utmTerm: body.utm_term,
    pageUrl: body.page_url, referrer: body.referrer, answers,
  };
}

export const allowSitesSchema = z.object({ sites: z.array(z.string().trim().min(1).max(253)).max(WEBSITE_SITE_LIMIT) }).strict();

export const websiteKeySchema = z.object({
  key: z.string().describe('The key placed in the site script tag'),
  allowedSites: z.array(z.string()).describe('Host names allowed to send leads with the key; subdomains are included'),
  createdAt: z.iso.datetime(),
  rotatedAt: z.iso.datetime().nullable(),
});
