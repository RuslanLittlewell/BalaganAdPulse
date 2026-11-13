import { z } from 'zod';
import type { RouteDoc } from '#shared/presentation/openapi.js';
import { DATASET_STATES, SEND_STATUSES } from '#modules/conversions/domain/conversions.js';
import { datasetSettingsSchema } from './conversions-http.js';

const dataset = z.object({
  datasetId: z.string(), datasetName: z.string(), testEventCode: z.string().nullable(), currency: z.string(),
  state: z.enum(DATASET_STATES), lastError: z.string().nullable(), lastSentAt: z.iso.datetime().nullable(),
});
const send = z.object({
  id: z.uuid(), leadId: z.uuid(), leadName: z.string(), eventName: z.string(), reachedAt: z.iso.datetime(),
  status: z.enum(SEND_STATUSES), lastError: z.string().nullable(), sentAt: z.iso.datetime().nullable(),
});
const summary = z.object({
  dataset: dataset.nullable(),
  counts: z.object({ today: z.int(), week: z.int(), month: z.int() }),
  recent: z.array(send),
});
const settings = datasetSettingsSchema.extend({ token: z.string().min(1).max(8192).optional().meta({ writeOnly: true }) });

export const conversionsDoc: RouteDoc = {
  tag: 'Meta Conversions API',
  tagDescription: 'A project sends the conversion events that leads from Meta lead forms reach on its CRM board to one Meta dataset. Tokens are write-only.',
  operations: [
    { method: 'get', path: '/:id/conversions-api', summary: 'Read the project\'s dataset, the events sent today and over the last 7 and 30 days in the Meta account\'s time zone, and the 20 latest events', success: { status: 200, description: 'Dataset and delivery summary; the token is never returned', schema: summary }, errors: [401, 403, 404] },
    { method: 'put', path: '/:id/conversions-api', summary: 'Connect a dataset or change its token, test event code and currency; a new dataset ID or token is checked with Meta first, and connecting queues the events reached in the last seven days', body: settings, success: { status: 200, description: 'Dataset and delivery summary', schema: summary }, errors: [400, 401, 403, 404] },
    { method: 'delete', path: '/:id/conversions-api', summary: 'Disconnect the dataset, dropping the events waiting to be sent and keeping the record of those sent', success: { status: 204, description: 'Disconnected' }, errors: [401, 403, 404] },
  ],
};
