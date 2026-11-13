import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ConversionsApi } from '../application/ports.js';
import { ConversionsApiError, type ConversionsApiFailure, type OutgoingEvent } from '../domain/conversions.js';

const LEAD_SOURCE = 'AdPulse';
const TEMPORARY_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
const AUTH_CODES = new Set([102, 190]);
const REASON_LIMIT = 500;

const graphError = z.object({
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
    error_user_msg: z.string().optional(),
    type: z.string().optional(),
  }),
});

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function classify(status: number, code: number | undefined): ConversionsApiFailure {
  if (status === 401 || (code !== undefined && AUTH_CODES.has(code))) return 'AUTH';
  if (status >= 500 || status === 429 || (code !== undefined && TEMPORARY_CODES.has(code))) return 'TEMPORARY';
  if (status === 400 && code === 100) return 'REFUSED';
  return 'TEMPORARY';
}

function payload(event: OutgoingEvent, placeholder: string) {
  const userData: Record<string, unknown> = { external_id: [sha256(event.leadId)] };
  if (/^\d{1,20}$/.test(event.metaLeadId)) userData.lead_id = placeholder;
  if (event.phone) userData.ph = [sha256(event.phone)];
  if (event.email) userData.em = [sha256(event.email)];
  const customData: Record<string, unknown> = { event_source: 'crm', lead_event_source: LEAD_SOURCE };
  if (event.value !== null && event.currency) {
    customData.value = event.value;
    customData.currency = event.currency;
  }
  return {
    event_name: event.eventName,
    event_time: Math.floor(event.eventTime.getTime() / 1000),
    action_source: 'system_generated',
    event_id: event.id,
    user_data: userData,
    custom_data: customData,
  };
}

export function conversionsBody(events: readonly OutgoingEvent[], testEventCode: string | null): string {
  const marker = randomUUID();
  const placeholder = (index: number) => `${marker}:${index}`;
  let json = JSON.stringify({ data: events.map((event, index) => payload(event, placeholder(index))), ...(testEventCode ? { test_event_code: testEventCode } : {}) });
  events.forEach((event, index) => { json = json.replace(`"${placeholder(index)}"`, event.metaLeadId); });
  return json;
}

export class MetaConversionsApi implements ConversionsApi {
  constructor(private readonly version = 'v22.0', private readonly fetcher: typeof fetch = fetch, private readonly requestTimeoutMs = 30_000) {}

  private async call(path: string, token: string, init: { method: 'GET' | 'POST'; query?: Record<string, string>; body?: string }, signal?: AbortSignal): Promise<unknown> {
    if (!/^v\d+\.0$/.test(this.version)) throw new ConversionsApiError('TEMPORARY', '', 'invalid Graph version');
    const url = new URL(`https://graph.facebook.com/${this.version}/${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    const timeout = AbortSignal.timeout(this.requestTimeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await this.fetcher(url, {
        method: init.method,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        ...(init.body ? { body: init.body } : {}),
        redirect: 'error',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      text = await response.text();
    } catch (error) {
      throw new ConversionsApiError('TEMPORARY', '', error instanceof Error ? error.name : 'network');
    }
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { body = null; }
    const failure = graphError.safeParse(body);
    if (!response.ok || failure.success) {
      const error = failure.success ? failure.data.error : undefined;
      const kind = classify(response.status, error?.code);
      const reason = (error?.error_user_msg ?? error?.message ?? `HTTP ${response.status}`).slice(0, REASON_LIMIT);
      throw new ConversionsApiError(kind, reason, `http ${response.status}, code ${error?.code ?? 'none'}`);
    }
    return body;
  }

  async dataset(datasetId: string, token: string, signal?: AbortSignal) {
    const parsed = z.object({ id: z.string(), name: z.string().default('') }).safeParse(
      await this.call(datasetId, token, { method: 'GET', query: { fields: 'id,name' } }, signal),
    );
    if (!parsed.success || parsed.data.id !== datasetId) throw new ConversionsApiError('REFUSED', 'Meta did not return this dataset');
    return { id: parsed.data.id, name: parsed.data.name };
  }

  async send(datasetId: string, token: string, events: readonly OutgoingEvent[], testEventCode: string | null, signal?: AbortSignal) {
    if (events.length === 0) return;
    await this.call(`${datasetId}/events`, token, { method: 'POST', body: conversionsBody(events, testEventCode) }, signal);
  }
}
