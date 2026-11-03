import { z } from "zod";
import { STARTER_MARKS, STARTER_NODES } from "#shared/domain/rich-text.js";
import { richText } from "#shared/presentation/input-schemas.js";
import { RESULT_TYPES } from "#modules/campaigns/index.js";
import { ENTERED_MONTHS, MAX_CHOSEN_ADS, REPORT_STATUSES } from "#modules/reports/domain/report.js";

const count = z.number().int().min(0).max(1_000_000);
const document = richText({ nodes: STARTER_NODES, marks: STARTER_MARKS });
const amount = z.string();
const fraction = z.string().nullable();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const spendInput = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/, "spend is a non-negative amount with up to four decimals");

export const listQuerySchema = z.object({ projectId: z.string().min(1).optional() });

export const generateSchema = z.object({ month }).strict();

export const editSchema = z.object({
  leadsOverride: count.nullable().optional(),
  messengerContacts: count.nullable().optional(),
  contactsSource: z.enum(RESULT_TYPES).nullable().optional(),
  conclusions: document.nullable().optional(),
  plan: document.nullable().optional(),
  adIds: z.array(z.string().min(1)).max(MAX_CHOSEN_ADS).optional(),
}).strict();

export const historySchema = z.object({
  months: z.array(z.object({ month, leads: count.nullable(), spend: spendInput.nullable() }).strict()).max(ENTERED_MONTHS),
}).strict();

const monthFigures = z.object({ month: z.string(), spend: amount.nullable(), leads: z.number().int(), costPerLead: amount.nullable() });
const enteredMonth = z.object({ month: z.string(), leads: z.number().int(), spend: amount.nullable() });
const resultTotal = z.object({ type: z.enum(RESULT_TYPES), results: z.number() });
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
  contactsSource: z.enum(RESULT_TYPES).nullable(),
  contacts: z.number().nullable(),
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
  resultTotals: z.array(resultTotal).nullable().optional(),
  history: z.array(enteredMonth).optional(),
});
