import { z } from "zod";
import { MAX_CHOSEN_ADS, REPORT_STATUSES } from "../../domain/report.js";

const count = z.number().int().min(0).max(1_000_000);
const document = z.record(z.string(), z.unknown());
const amount = z.string();
const fraction = z.string().nullable();

export const listQuerySchema = z.object({ projectId: z.string().min(1).optional() });

export const generateSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict();

export const editSchema = z.object({
  leadsOverride: count.nullable().optional(),
  messengerContacts: count.nullable().optional(),
  conclusions: document.nullable().optional(),
  plan: document.nullable().optional(),
  adIds: z.array(z.string().min(1)).max(MAX_CHOSEN_ADS).optional(),
}).strict();

const monthFigures = z.object({ month: z.string(), spend: amount, leads: z.number().int(), costPerLead: amount.nullable() });
const adFigures = z.object({ adId: z.string(), name: z.string(), spend: amount, leads: z.number().int(), costPerLead: amount.nullable() });

export const reportSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  month: z.string(),
  status: z.enum(REPORT_STATUSES),
  currency: z.string().nullable(),
  spend: amount,
  leads: z.number().int(),
  costPerLead: amount.nullable(),
  publishedAt: z.iso.datetime().nullable(),
});

export const reportListSchema = z.object({
  reports: z.array(reportSummarySchema),
  available: z.array(z.string()),
});

export const reportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  month: z.string(),
  status: z.enum(REPORT_STATUSES),
  currency: z.string().nullable(),
  spend: amount,
  leads: z.number().int(),
  costPerLead: amount.nullable(),
  previous: monthFigures.nullable(),
  change: z.object({ leads: fraction, costPerLead: fraction }),
  trend: z.array(monthFigures),
  ads: z.array(adFigures),
  messengerContacts: z.number().int().nullable(),
  hasCover: z.boolean(),
  conclusions: document.nullable(),
  plan: document.nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  computedAt: z.iso.datetime().optional(),
  computedLeads: z.number().int().optional(),
  leadsOverride: z.number().int().nullable().optional(),
  runningAds: z.array(adFigures).optional(),
});
