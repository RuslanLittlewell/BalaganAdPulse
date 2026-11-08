import { z } from "zod";
import type { Analytics } from "../application/ports.js";
import { SeoProviderError } from "../domain/seo-site.js";
import type { PropertyChoice, TrafficRow } from "../domain/traffic.js";
import { askGoogle, refusal } from "./google-request.js";

const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const DATA = "https://analyticsdata.googleapis.com/v1beta";
const PAGE = 10_000;
const MAX_PAGES = 50;
const MAX_SUMMARY_PAGES = 20;

const summariesBody = z.object({
  accountSummaries: z.array(z.object({
    displayName: z.string().optional(),
    propertySummaries: z.array(z.object({ property: z.string().regex(/^properties\/\d+$/), displayName: z.string().optional() })).optional(),
  })).optional(),
  nextPageToken: z.string().optional(),
});

const reportBody = z.object({
  rows: z.array(z.object({
    dimensionValues: z.array(z.object({ value: z.string() })).length(4),
    metricValues: z.array(z.object({ value: z.string() })).min(1),
  })).optional(),
  rowCount: z.number().int().nonnegative().optional(),
});

export interface SignInTokens {
  consentUrl(state: string): string;
  accessToken(refreshToken: string, signal?: AbortSignal): Promise<string>;
}

function shaped<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SeoProviderError("INVALID_DATA", 0, `${what} shape`);
  return parsed.data;
}

const isoDate = (compact: string) => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

export class AnalyticsClient implements Analytics {
  constructor(
    private readonly tokens: SignInTokens,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 60_000,
  ) {}

  consentUrl(state: string): string {
    return this.tokens.consentUrl(state);
  }

  accessToken(refreshToken: string, signal?: AbortSignal): Promise<string> {
    return this.tokens.accessToken(refreshToken, signal);
  }

  async properties(accessToken: string, signal?: AbortSignal): Promise<PropertyChoice[]> {
    const choices: PropertyChoice[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_SUMMARY_PAGES; page++) {
      const query = new URLSearchParams({ pageSize: "200", ...(pageToken ? { pageToken } : {}) });
      const body = shaped(summariesBody, await this.ask(accessToken, `${ADMIN}/accountSummaries?${query}`, undefined, signal), "account summaries");
      for (const account of body.accountSummaries ?? []) {
        for (const property of account.propertySummaries ?? []) {
          const name = [account.displayName, property.displayName].filter(Boolean).join(" / ");
          choices.push({ propertyId: property.property.slice("properties/".length), name: name || property.property });
        }
      }
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }
    return choices;
  }

  async sessions(accessToken: string, propertyId: string, from: string, to: string, signal?: AbortSignal): Promise<TrafficRow[]> {
    const rows: TrafficRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = shaped(reportBody, await this.ask(accessToken, `${DATA}/properties/${encodeURIComponent(propertyId)}:runReport`, {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }, { name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }],
        limit: PAGE,
        offset: page * PAGE,
      }, signal), "report");
      const received = body.rows ?? [];
      for (const row of received) {
        const [date, channel, source, medium] = row.dimensionValues.map((entry) => entry.value) as [string, string, string, string];
        const sessions = Number(row.metricValues[0]!.value);
        if (!/^\d{8}$/.test(date) || !Number.isFinite(sessions)) throw new SeoProviderError("INVALID_DATA", 0, "report row");
        rows.push({ date: isoDate(date), channel: channel.slice(0, 128), source: source.slice(0, 255), medium: medium.slice(0, 255), sessions: Math.round(sessions) });
      }
      if (received.length < PAGE || rows.length >= (body.rowCount ?? 0)) break;
    }
    return rows;
  }

  private async ask(accessToken: string, url: string, body: Record<string, unknown> | undefined, signal?: AbortSignal): Promise<unknown> {
    const answer = await askGoogle(this.fetcher, url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, this.timeoutMs, signal);
    if (!answer.ok) throw refusal(answer);
    if (answer.body === null) throw new SeoProviderError("INVALID_DATA", 0, "not json");
    return answer.body;
  }
}
