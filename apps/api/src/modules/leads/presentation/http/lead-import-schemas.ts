import { z } from 'zod';
import { IMPORT_BYTES_LIMIT, IMPORT_ROW_LIMIT } from '#modules/leads/domain/lead-import.js';

const cell = z.string().max(10_000).nullish().transform((value) => value ?? null);

export const importSourceSchema = z.union([
  z.object({ csv: z.string().max(IMPORT_BYTES_LIMIT).describe('The text of a CSV file') }).strict(),
  z.object({ url: z.string().max(2048).describe('The link of a Google Sheet open to anyone with the link') }).strict(),
]);

export const importRowSchema = z.object({
  name: cell,
  phone: cell,
  email: cell,
  submittedAt: cell.describe('The submission date as the table holds it: ISO 8601 or DD.MM.YYYY with an optional time'),
  campaign: cell.describe('The value that names the campaign: a campaign, ad set or ad ID, or the campaign name'),
  status: cell.describe('The status that names a board column: a column name, or a fixed stage key or name'),
  utmSource: cell,
  utmMedium: cell,
  utmCampaign: cell,
  utmContent: cell,
  utmTerm: cell,
  pageUrl: cell,
  referrer: cell,
  answers: z.array(z.object({ question: z.string().max(10_000), values: z.array(z.string().max(10_000)).max(50) })).max(200).default([]),
});

export const importPreviewSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(IMPORT_ROW_LIMIT),
});

export const importRunSchema = importPreviewSchema.extend({
  choices: z.array(z.object({
    value: z.string().max(10_000).nullable().describe('A campaign value from the preview; null stands for rows without one'),
    campaignId: z.uuid().nullable().describe('The campaign for those rows; null leaves them without a campaign'),
  })).max(IMPORT_ROW_LIMIT).default([]),
  placements: z.array(z.object({
    value: z.string().max(10_000).describe('A status from the preview'),
    columnId: z.string().max(100).describe('A fixed stage key or the ID of a board column'),
  })).max(IMPORT_ROW_LIMIT).default([]),
});

export const importTableSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) });

const skipped = z.object({
  onBoard: z.int().describe('Rows whose phone or email belongs to a lead on the board, or that were imported before'),
  repeated: z.int().describe('Rows whose phone or email repeats an earlier row'),
  empty: z.int().describe('Rows with no name, phone or email'),
});

export const importPreviewResultSchema = z.object({
  added: z.int(),
  skipped,
  undated: z.int().describe('Leads to add whose date could not be read; they arrive at the import time'),
  campaigns: z.array(z.object({
    value: z.string().nullable(),
    leads: z.int(),
    campaign: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  })),
  statuses: z.array(z.object({
    value: z.string(),
    leads: z.int(),
    column: z.object({ id: z.string(), name: z.string() }).nullable().describe('The board column the status names; null sends its leads to the first column'),
  })),
});

export const importResultSchema = z.object({ added: z.int(), skipped });
