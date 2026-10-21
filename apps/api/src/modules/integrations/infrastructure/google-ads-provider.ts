import { z } from "zod";
import { ProviderError, type Account, type GoogleAccountChoice } from "../domain/integration.js";
import type { ImportedEntity, ImportedMetric, ImportedStatus, Snapshot } from "../domain/snapshot.js";
import type { SnapshotSource } from "../application/import-worker.js";
import { localDate, shiftDate } from "../application/schedule.js";
import { exchange, type GoogleResponse } from "./google-http.js";
import type { GoogleOAuth } from "./google-oauth.js";

const MAX_PAGES = 200;
const MAX_ROWS = 200_000;
const MAX_ACCESSIBLE = 50;
const MAX_CHOICES = 500;

const customerId = z.string().regex(/^\d{1,20}$/);
const count = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647));
const micros = z.string().regex(/^\d+$/).transform((value) => BigInt(value));
const quantity = z.number().finite().min(0).max(1e12);
const figures = z.object({
  costMicros: micros.prefault("0"),
  impressions: count.prefault("0"),
  clicks: count.prefault("0"),
  conversions: quantity.default(0),
  conversionsValue: quantity.default(0),
});
const date = z.object({ date: z.iso.date() });
const status = z.enum(["ENABLED", "PAUSED", "REMOVED"]);
const name = z.string().default("");
const page = z.object({ results: z.array(z.unknown()).default([]), nextPageToken: z.string().optional() });
const accessible = z.object({ resourceNames: z.array(z.string()).default([]) });
const failure = z.object({
  error: z.object({
    status: z.string().optional(),
    details: z.array(z.object({
      errors: z.array(z.object({ errorCode: z.record(z.string(), z.unknown()).default({}) })).default([]),
    })).default([]),
  }).optional(),
});

const campaignRow = z.object({ campaign: z.object({ id: customerId, name, status, advertisingChannelType: z.string().optional() }) });
const adGroupRow = z.object({ adGroup: z.object({ id: customerId, name, status }), campaign: z.object({ id: customerId }) });
const adRow = z.object({ adGroupAd: z.object({ ad: z.object({ id: customerId, name }), status }), adGroup: z.object({ id: customerId }) });
const campaignMetricRow = z.object({ campaign: z.object({ id: customerId }), segments: date, metrics: figures });
const adGroupMetricRow = z.object({ adGroup: z.object({ id: customerId }), segments: date, metrics: figures });
const adMetricRow = z.object({ adGroupAd: z.object({ ad: z.object({ id: customerId }) }), segments: date, metrics: figures });
const customerRow = z.object({ customer: z.object({ id: customerId, currencyCode: z.string().min(1), timeZone: z.string().min(1) }) });
const clientRow = z.object({
  customerClient: z.object({
    id: customerId,
    descriptiveName: z.string().default(""),
    currencyCode: z.string().default(""),
    timeZone: z.string().default(""),
    manager: z.boolean().default(false),
  }),
});

const statuses: Record<z.infer<typeof status>, ImportedStatus> = { ENABLED: "ACTIVE", PAUSED: "PAUSED", REMOVED: "ENDED" };
const ACCESS_CODES = new Set([
  "USER_PERMISSION_DENIED", "DEVELOPER_TOKEN_NOT_APPROVED", "DEVELOPER_TOKEN_PROHIBITED", "DEVELOPER_TOKEN_INVALID",
  "CUSTOMER_NOT_ENABLED", "NOT_ADS_USER", "CUSTOMER_NOT_FOUND", "ACTION_NOT_PERMITTED",
]);
const READABLE = "campaign.status != 'REMOVED'";

export interface GoogleAdsSettings {
  apiVersion: string;
}

export function spendOf(costMicros: bigint): string {
  const tenThousandths = (costMicros + 50n) / 100n;
  return `${tenThousandths / 10_000n}.${(tenThousandths % 10_000n).toString().padStart(4, "0")}`;
}

const amount = (value: number) => value.toFixed(4);

function metricOf(externalId: string, day: string, row: z.infer<typeof figures>): ImportedMetric {
  const conversions = Math.min(Math.round(row.conversions), 2147483647);
  return {
    externalId,
    date: day,
    spend: spendOf(row.costMicros),
    impressions: row.impressions,
    reach: 0,
    clicks: row.clicks,
    conversions,
    results: conversions,
    revenue: amount(row.conversionsValue),
  };
}

export class GoogleAdsProvider implements SnapshotSource {
  constructor(
    private readonly oauth: Pick<GoogleOAuth, "accessToken">,
    private readonly settings: GoogleAdsSettings,
    private readonly fetcher: typeof fetch = fetch,
    private readonly requestTimeoutMs = 30_000,
  ) {}

  private classify(response: GoogleResponse): ProviderError {
    const parsed = failure.safeParse(response.body);
    const reason = parsed.data?.error?.status ?? "none";
    const codes = (parsed.data?.error?.details ?? []).flatMap((detail) => detail.errors.flatMap((entry) => Object.values(entry.errorCode)));
    const detail = `http ${response.status}, status ${reason}, codes ${codes.join(",") || "none"}`;
    if (response.status === 401) return new ProviderError("TOKEN", 0, detail, "Google");
    if (codes.some((code) => typeof code === "string" && ACCESS_CODES.has(code)) || response.status === 403 || response.status === 404) {
      return new ProviderError("ACCESS", 0, detail, "Google");
    }
    if (response.status === 429 || response.status >= 500 || reason === "RESOURCE_EXHAUSTED") {
      return new ProviderError("PROVIDER", response.retryAfterMs, detail, "Google");
    }
    return new ProviderError("INVALID_DATA", 0, detail, "Google");
  }

  private async call(path: string, access: string, login: string | null, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    const response = await exchange(this.fetcher, `https://googleads.googleapis.com/${this.settings.apiVersion}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        ...(login ? { "login-customer-id": login } : {}),
      },
    }, this.requestTimeoutMs, signal);
    if (!response.ok) throw this.classify(response);
    return response.body;
  }

  private async search(account: string, login: string | null, access: string, query: string, signal?: AbortSignal): Promise<unknown[]> {
    const rows: unknown[] = [];
    let pageToken: string | undefined;
    const seen = new Set<string>();
    for (let index = 0; index < MAX_PAGES; index++) {
      const result = page.safeParse(await this.call(`customers/${account}/googleAds:search`, access, login, {
        method: "POST",
        body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      }, signal));
      if (!result.success) throw new ProviderError("INVALID_DATA", 0, "", "Google");
      rows.push(...result.data.results);
      if (rows.length > MAX_ROWS) throw new ProviderError("INVALID_DATA", 0, "too many rows", "Google");
      pageToken = result.data.nextPageToken;
      if (!pageToken) return rows;
      if (seen.has(pageToken)) throw new ProviderError("INVALID_DATA", 0, "", "Google");
      seen.add(pageToken);
    }
    throw new ProviderError("INVALID_DATA", 0, "too many pages", "Google");
  }

  private parsed<T extends z.ZodType>(schema: T, rows: unknown[]): z.infer<T>[] {
    return rows.map((row) => {
      const result = schema.safeParse(row);
      if (!result.success) {
        const paths = result.error.issues.slice(0, 3).map((issue) => issue.path.join("."));
        throw new ProviderError("INVALID_DATA", 0, `unexpected fields: ${paths.join(", ")}`, "Google");
      }
      return result.data;
    });
  }

  async accounts(refreshToken: string, signal?: AbortSignal): Promise<GoogleAccountChoice[]> {
    const access = await this.oauth.accessToken(refreshToken, signal);
    const listed = accessible.safeParse(await this.call("customers:listAccessibleCustomers", access, null, { method: "GET" }, signal));
    if (!listed.success) throw new ProviderError("INVALID_DATA", 0, "", "Google");
    const roots = listed.data.resourceNames
      .map((resource) => /^customers\/(\d{1,20})$/.exec(resource)?.[1])
      .filter((value): value is string => value !== undefined)
      .slice(0, MAX_ACCESSIBLE);
    const choices = new Map<string, GoogleAccountChoice>();
    for (const root of roots) {
      let rows: z.infer<typeof clientRow>[];
      try {
        rows = this.parsed(clientRow, await this.search(root, root, access,
          "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager FROM customer_client WHERE customer_client.status = 'ENABLED'", signal));
      } catch (error) {
        if (error instanceof ProviderError && (error.code === "ACCESS" || error.code === "INVALID_DATA")) continue;
        throw error;
      }
      for (const { customerClient: client } of rows) {
        if (client.manager || !client.currencyCode || !client.timeZone) continue;
        const direct = client.id === root;
        if (choices.has(client.id) && !direct) continue;
        choices.set(client.id, {
          accountId: client.id,
          name: client.descriptiveName || client.id,
          currency: client.currencyCode,
          timezone: client.timeZone,
          loginCustomerId: direct ? null : root,
        });
      }
    }
    return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_CHOICES);
  }

  async account(accountId: string, loginCustomerId: string | null, refreshToken: string, signal?: AbortSignal): Promise<Account> {
    if (!customerId.safeParse(accountId).success || (loginCustomerId !== null && !customerId.safeParse(loginCustomerId).success)) {
      throw new ProviderError("INVALID_DATA", 0, "", "Google");
    }
    const access = await this.oauth.accessToken(refreshToken, signal);
    const [row] = this.parsed(customerRow, await this.search(accountId, loginCustomerId, access,
      "SELECT customer.id, customer.currency_code, customer.time_zone FROM customer", signal));
    if (!row || row.customer.id !== accountId) throw new ProviderError("INVALID_DATA", 0, "", "Google");
    try {
      localDate(new Date(), row.customer.timeZone);
    } catch {
      throw new ProviderError("INVALID_DATA", 0, "", "Google");
    }
    return { accountId, currency: row.customer.currencyCode, timezone: row.customer.timeZone };
  }

  async snapshot(
    account: Pick<Account, "accountId" | "currency"> & { loginCustomerId: string | null },
    refreshToken: string,
    now: Date,
    signal?: AbortSignal,
  ): Promise<Snapshot> {
    const verified = await this.account(account.accountId, account.loginCustomerId, refreshToken, signal);
    if (verified.currency !== account.currency) throw new ProviderError("CURRENCY", 0, "", "Google");
    const access = await this.oauth.accessToken(refreshToken, signal);
    const run = (query: string) => this.search(account.accountId, account.loginCustomerId, access, query, signal);

    const today = localDate(now, verified.timezone);
    const from = shiftDate(today, -30);
    const to = shiftDate(today, -1);
    const days = `segments.date BETWEEN '${from}' AND '${to}'`;
    const adGroupScope = `ad_group.status != 'REMOVED' AND ${READABLE}`;
    const adScope = `ad_group_ad.status != 'REMOVED' AND ${adGroupScope}`;
    const metricFields = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value";

    const campaigns: ImportedEntity[] = this.parsed(campaignRow, await run(
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE ${READABLE}`,
    )).map(({ campaign }) => ({ id: campaign.id, name: campaign.name || `Campaign ${campaign.id}`, status: statuses[campaign.status], objective: campaign.advertisingChannelType }));
    const adSets: ImportedEntity[] = this.parsed(adGroupRow, await run(
      `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id FROM ad_group WHERE ${adGroupScope}`,
    )).map(({ adGroup, campaign }) => ({ id: adGroup.id, name: adGroup.name || `Ad group ${adGroup.id}`, status: statuses[adGroup.status], parentId: campaign.id }));
    const ads: ImportedEntity[] = this.parsed(adRow, await run(
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group.id FROM ad_group_ad WHERE ${adScope}`,
    )).map(({ adGroupAd, adGroup }) => ({ id: adGroupAd.ad.id, name: adGroupAd.ad.name || `Ad ${adGroupAd.ad.id}`, status: statuses[adGroupAd.status], parentId: adGroup.id }));

    const campaignMetrics = this.parsed(campaignMetricRow, await run(
      `SELECT campaign.id, segments.date, ${metricFields} FROM campaign WHERE ${days} AND ${READABLE}`,
    )).map((row) => metricOf(row.campaign.id, row.segments.date, row.metrics));
    const adSetMetrics = this.parsed(adGroupMetricRow, await run(
      `SELECT ad_group.id, segments.date, ${metricFields} FROM ad_group WHERE ${days} AND ${adGroupScope}`,
    )).map((row) => metricOf(row.adGroup.id, row.segments.date, row.metrics));
    const adMetrics = this.parsed(adMetricRow, await run(
      `SELECT ad_group_ad.ad.id, segments.date, ${metricFields} FROM ad_group_ad WHERE ${days} AND ${adScope}`,
    )).map((row) => metricOf(row.adGroupAd.ad.id, row.segments.date, row.metrics));

    return { from, to, campaigns, adSets, ads, campaignMetrics, adSetMetrics, adMetrics };
  }
}
