import { z } from "zod";
import type { SearchConsole } from "../application/ports.js";
import { SeoProviderError, type SiteChoice } from "../domain/seo-site.js";
import { TOP_PER_DAY, type SearchDay, type TopKind, type TopRow } from "../domain/search.js";
import { askGoogle, refusal } from "./google-request.js";

const BASE = "https://searchconsole.googleapis.com/webmasters/v3";
const MAX_ROWS = 25_000;

const sitesBody = z.object({
  siteEntry: z.array(z.object({ siteUrl: z.string().min(1), permissionLevel: z.string() })).optional(),
});
const analyticsBody = z.object({
  rows: z.array(z.object({
    keys: z.array(z.string()).min(1),
    clicks: z.number().nonnegative(),
    impressions: z.number().nonnegative(),
    position: z.number().nonnegative(),
  })).optional(),
});
const sitemapsBody = z.object({ sitemap: z.array(z.object({ path: z.string().min(1) })).optional() });

function shaped<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SeoProviderError("INVALID_DATA", 0, `${what} shape`);
  return parsed.data;
}

export interface SignInTokens {
  consentUrl(state: string): string;
  accessToken(refreshToken: string, signal?: AbortSignal): Promise<string>;
}

export class SearchConsoleClient implements SearchConsole {
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

  async sites(accessToken: string, signal?: AbortSignal): Promise<SiteChoice[]> {
    const body = shaped(sitesBody, await this.read(accessToken, `${BASE}/sites`, undefined, signal), "sites");
    return (body.siteEntry ?? []).filter((entry) => entry.permissionLevel !== "siteUnverifiedUser");
  }

  async totals(accessToken: string, siteUrl: string, from: string, to: string, signal?: AbortSignal): Promise<SearchDay[]> {
    const rows = await this.query(accessToken, siteUrl, { startDate: from, endDate: to, dimensions: ["date"], rowLimit: MAX_ROWS }, signal);
    return rows.map((row) => ({ date: row.keys[0]!, clicks: Math.round(row.clicks), impressions: Math.round(row.impressions), position: row.position }));
  }

  async top(accessToken: string, siteUrl: string, date: string, kind: TopKind, signal?: AbortSignal): Promise<Omit<TopRow, "date">[]> {
    const rows = await this.query(accessToken, siteUrl, { startDate: date, endDate: date, dimensions: [kind], rowLimit: TOP_PER_DAY }, signal);
    return rows.map((row) => ({ key: row.keys[0]!, clicks: Math.round(row.clicks), impressions: Math.round(row.impressions), position: row.position }));
  }

  async sitemaps(accessToken: string, siteUrl: string, signal?: AbortSignal): Promise<string[]> {
    const body = shaped(sitemapsBody, await this.read(accessToken, `${BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`, undefined, signal), "sitemaps");
    return (body.sitemap ?? []).map((entry) => entry.path);
  }

  private async query(accessToken: string, siteUrl: string, request: Record<string, unknown>, signal?: AbortSignal) {
    const url = `${BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const body = await this.read(accessToken, url, { ...request, type: "web", dataState: "final" }, signal);
    return shaped(analyticsBody, body, "search analytics").rows ?? [];
  }

  private async read(accessToken: string, url: string, body: Record<string, unknown> | undefined, signal?: AbortSignal): Promise<unknown> {
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
