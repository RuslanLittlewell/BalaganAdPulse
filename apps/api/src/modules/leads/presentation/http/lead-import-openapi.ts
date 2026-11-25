import type { RouteDoc } from '#shared/presentation/openapi.js';
import {
  importPreviewResultSchema,
  importPreviewSchema,
  importResultSchema,
  importRunSchema,
  importSourceSchema,
  importTableSchema,
} from './lead-import-schemas.js';

export const leadImportDoc: RouteDoc = {
  tag: 'CRM lead import',
  tagDescription:
    "Bringing a table of leads onto a project's board. Admins and client admins read the table, map its columns in the browser, preview the outcome and import it.",
  operations: [
    {
      method: 'post',
      path: '/table',
      summary: 'Read a CSV text or a Google Sheet into columns and rows',
      description: 'Values may be separated by commas, semicolons or tabs. A sheet must be open to anyone with the link; the tab in the link is read. A table holds at most 5000 rows.',
      body: importSourceSchema,
      success: { status: 200, description: 'The column names and the rows', schema: importTableSchema },
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/preview',
      summary: 'Show what an import of mapped rows would add, skip and link',
      body: importPreviewSchema,
      success: { status: 200, description: 'The counts and every campaign value with its campaign', schema: importPreviewResultSchema },
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/',
      summary: 'Import mapped rows as leads on top of the columns their statuses name',
      description: 'A row whose phone or email belongs to a lead on the board, repeats an earlier row or was imported before is skipped. Choices override the campaign found for a value, and placements the column found for a status; a lead with no column lands in the first column.',
      body: importRunSchema,
      success: { status: 201, description: 'The number of leads added and rows skipped', schema: importResultSchema },
      errors: [400, 401, 403, 404],
    },
  ],
};
