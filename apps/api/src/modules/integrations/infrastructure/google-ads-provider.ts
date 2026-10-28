import { z } from "zod";
import { ProviderError, type Account, type GoogleAccountChoice } from "../domain/integration.js";
import type { ImportedCreative, ImportedEntity, ImportedMetric, ImportedResult, ImportedStatus, Snapshot } from "../domain/snapshot.js";
import type { SnapshotSource } from "../application/import-worker.js";
import type { GoogleCreativeSource } from "../application/ports.js";
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
  allConversions: quantity.default(0),
  conversionsValue: quantity.default(0),
});
const date = z.object({ date: z.iso.date() });
const category = z.string().regex(/^[A-Z_]{1,64}$/);
const byCategory = z.object({ date: z.iso.date(), conversionActionCategory: category });
const allConversions = z.object({ allConversions: quantity.default(0) });
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
const campaignResultRow = z.object({ campaign: z.object({ id: customerId }), segments: byCategory, metrics: allConversions });
const adGroupResultRow = z.object({ adGroup: z.object({ id: customerId }), segments: byCategory, metrics: allConversions });
const adResultRow = z.object({ adGroupAd: z.object({ ad: z.object({ id: customerId }) }), segments: byCategory, metrics: allConversions });
const conversionActionRow = z.object({ conversionAction: z.object({ category }) });
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

const textAsset = z.object({ text: z.string().default("") });
const textList = z.array(textAsset).default([]);
const assetRef = z.object({ asset: z.string().default("") });
const refList = z.array(assetRef).default([]);
const optionalText = z.string().optional();
const adContentRow = z.object({
  adGroupAd: z.object({
    ad: z.object({
      id: customerId,
      imageAd: z.object({ imageUrl: optionalText, previewImageUrl: optionalText, name: optionalText }).optional(),
      responsiveSearchAd: z.object({ headlines: textList, descriptions: textList }).optional(),
      expandedTextAd: z.object({
        headlinePart1: optionalText, headlinePart2: optionalText, headlinePart3: optionalText,
        description: optionalText, description2: optionalText,
      }).optional(),
      responsiveDisplayAd: z.object({
        marketingImages: refList, squareMarketingImages: refList, youtubeVideos: refList,
        headlines: textList, longHeadline: textAsset.optional(), descriptions: textList,
      }).optional(),
      videoAd: z.object({ video: assetRef.optional() }).optional(),
      videoResponsiveAd: z.object({ videos: refList, headlines: textList, longHeadlines: textList, descriptions: textList }).optional(),
      demandGenMultiAssetAd: z.object({
        marketingImages: refList, squareMarketingImages: refList, portraitMarketingImages: refList,
        headlines: textList, descriptions: textList,
      }).optional(),
      demandGenVideoResponsiveAd: z.object({ videos: refList, headlines: textList, longHeadlines: textList, descriptions: textList }).optional(),
    }),
  }),
});
const assetRow = z.object({
  asset: z.object({
    resourceName: z.string(),
    imageAsset: z.object({ fullSize: z.object({ url: optionalText }).optional() }).optional(),
    youtubeVideoAsset: z.object({ youtubeVideoId: optionalText, youtubeVideoTitle: optionalText }).optional(),
  }),
});

const AD_CONTENT_FIELDS = [
  "ad_group_ad.ad.id",
  "ad_group_ad.ad.image_ad.image_url", "ad_group_ad.ad.image_ad.preview_image_url", "ad_group_ad.ad.image_ad.name",
  "ad_group_ad.ad.responsive_search_ad.headlines", "ad_group_ad.ad.responsive_search_ad.descriptions",
  "ad_group_ad.ad.expanded_text_ad.headline_part1", "ad_group_ad.ad.expanded_text_ad.headline_part2", "ad_group_ad.ad.expanded_text_ad.headline_part3",
  "ad_group_ad.ad.expanded_text_ad.description", "ad_group_ad.ad.expanded_text_ad.description2",
  "ad_group_ad.ad.responsive_display_ad.marketing_images", "ad_group_ad.ad.responsive_display_ad.square_marketing_images",
  "ad_group_ad.ad.responsive_display_ad.youtube_videos", "ad_group_ad.ad.responsive_display_ad.headlines",
  "ad_group_ad.ad.responsive_display_ad.long_headline", "ad_group_ad.ad.responsive_display_ad.descriptions",
  "ad_group_ad.ad.video_ad.video.asset",
  "ad_group_ad.ad.video_responsive_ad.videos", "ad_group_ad.ad.video_responsive_ad.headlines",
  "ad_group_ad.ad.video_responsive_ad.long_headlines", "ad_group_ad.ad.video_responsive_ad.descriptions",
  "ad_group_ad.ad.demand_gen_multi_asset_ad.marketing_images", "ad_group_ad.ad.demand_gen_multi_asset_ad.square_marketing_images",
  "ad_group_ad.ad.demand_gen_multi_asset_ad.portrait_marketing_images", "ad_group_ad.ad.demand_gen_multi_asset_ad.headlines",
  "ad_group_ad.ad.demand_gen_multi_asset_ad.descriptions",
  "ad_group_ad.ad.demand_gen_video_responsive_ad.videos", "ad_group_ad.ad.demand_gen_video_responsive_ad.headlines",
  "ad_group_ad.ad.demand_gen_video_responsive_ad.long_headlines", "ad_group_ad.ad.demand_gen_video_responsive_ad.descriptions",
].join(", ");

const MAX_CREATIVE_IMAGES = 8;
const MAX_CREATIVE_VIDEOS = 4;
const MAX_CREATIVE_LINES = 30;
const MAX_CREATIVE_LINE = 500;
const ASSET_NAME = /^customers\/\d{1,20}\/assets\/(\d{1,20})$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

const unique = <T>(items: readonly T[]) => [...new Set(items)];
const lines = (items: readonly (string | undefined)[]) =>
  unique(items.map((item) => item?.trim() ?? "").filter((item) => item !== "")).slice(0, MAX_CREATIVE_LINES).map((item) => item.slice(0, MAX_CREATIVE_LINE));
const texts = (assets: readonly { text: string }[] | undefined) => (assets ?? []).map((asset) => asset.text);
const refs = (assets: readonly { asset: string }[] | undefined) => (assets ?? []).map((ref) => ref.asset);

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

const wholeCount = (value: number) => Math.min(Math.round(value), 2147483647);

function metricOf(externalId: string, day: string, row: z.infer<typeof figures>): ImportedMetric {
  return {
    externalId,
    date: day,
    spend: spendOf(row.costMicros),
    impressions: row.impressions,
    reach: 0,
    clicks: row.clicks,
    conversions: wholeCount(row.conversions),
    results: wholeCount(row.allConversions),
    revenue: amount(row.conversionsValue),
  };
}

function resultsOf(rows: readonly { id: string; segments: z.infer<typeof byCategory>; metrics: z.infer<typeof allConversions> }[]): ImportedResult[] {
  return rows
    .filter(({ metrics }) => metrics.allConversions > 0)
    .map(({ id, segments, metrics }) => ({
      externalId: id, date: segments.date, category: segments.conversionActionCategory, results: amount(metrics.allConversions),
    }));
}

export class GoogleAdsProvider implements SnapshotSource, GoogleCreativeSource {
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

  async adCreatives(
    adExternalId: string,
    account: { accountId: string; loginCustomerId: string | null },
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<ImportedCreative[]> {
    if (
      !customerId.safeParse(adExternalId).success
      || !customerId.safeParse(account.accountId).success
      || (account.loginCustomerId !== null && !customerId.safeParse(account.loginCustomerId).success)
    ) {
      throw new ProviderError("INVALID_DATA", 0, "", "Google");
    }
    const access = await this.oauth.accessToken(refreshToken, signal);
    const run = (query: string) => this.search(account.accountId, account.loginCustomerId, access, query, signal);
    const [row] = this.parsed(adContentRow, await run(
      `SELECT ${AD_CONTENT_FIELDS} FROM ad_group_ad WHERE ad_group_ad.ad.id = ${adExternalId} AND ad_group_ad.status != 'REMOVED'`,
    ));
    if (!row) return [];
    const ad = row.adGroupAd.ad;
    const display = ad.responsiveDisplayAd;
    const demand = ad.demandGenMultiAssetAd;
    const videoResponsive = ad.videoResponsiveAd;
    const demandVideo = ad.demandGenVideoResponsiveAd;
    const expanded = ad.expandedTextAd;

    const imageRefs = unique([
      ...refs(display?.marketingImages), ...refs(display?.squareMarketingImages),
      ...refs(demand?.marketingImages), ...refs(demand?.squareMarketingImages), ...refs(demand?.portraitMarketingImages),
    ]).slice(0, MAX_CREATIVE_IMAGES);
    const videoRefs = unique([
      ...refs(display?.youtubeVideos), ...(ad.videoAd?.video ? [ad.videoAd.video.asset] : []),
      ...refs(videoResponsive?.videos), ...refs(demandVideo?.videos),
    ]).slice(0, MAX_CREATIVE_VIDEOS);
    const headlines = lines([
      ...texts(ad.responsiveSearchAd?.headlines),
      expanded?.headlinePart1, expanded?.headlinePart2, expanded?.headlinePart3,
      ...texts(display?.headlines), display?.longHeadline?.text,
      ...texts(videoResponsive?.headlines), ...texts(videoResponsive?.longHeadlines),
      ...texts(demand?.headlines),
      ...texts(demandVideo?.headlines), ...texts(demandVideo?.longHeadlines),
    ]);
    const descriptions = lines([
      ...texts(ad.responsiveSearchAd?.descriptions),
      expanded?.description, expanded?.description2,
      ...texts(display?.descriptions), ...texts(videoResponsive?.descriptions),
      ...texts(demand?.descriptions), ...texts(demandVideo?.descriptions),
    ]);

    const wanted = unique([...imageRefs, ...videoRefs].filter((name) => ASSET_NAME.test(name)));
    const assets = new Map<string, z.infer<typeof assetRow>["asset"]>();
    if (wanted.length > 0) {
      const found = this.parsed(assetRow, await run(
        `SELECT asset.resource_name, asset.image_asset.full_size.url, asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title FROM asset WHERE asset.resource_name IN (${wanted.map((name) => `'${name}'`).join(", ")})`,
      ));
      for (const { asset } of found) assets.set(asset.resourceName, asset);
    }

    const creatives: ImportedCreative[] = [];
    const add = (creative: Omit<ImportedCreative, "adExternalId" | "position">) =>
      creatives.push({ adExternalId, position: creatives.length, ...creative });
    const secure = (url: string | undefined) => (url && /^https:\/\//.test(url) ? url : undefined);

    const imageUrl = secure(ad.imageAd?.imageUrl) ?? secure(ad.imageAd?.previewImageUrl);
    if (imageUrl) add({ creativeId: "image", kind: "IMAGE", fileUrl: imageUrl, title: ad.imageAd?.name || undefined });
    for (const name of imageRefs) {
      const url = secure(assets.get(name)?.imageAsset?.fullSize?.url);
      const id = ASSET_NAME.exec(name)?.[1];
      if (url && id) add({ creativeId: id, kind: "IMAGE", fileUrl: url });
    }
    for (const name of videoRefs) {
      const video = assets.get(name)?.youtubeVideoAsset;
      const id = video?.youtubeVideoId;
      if (!id || !YOUTUBE_ID.test(id)) continue;
      add({
        creativeId: id,
        kind: "VIDEO",
        title: video.youtubeVideoTitle || undefined,
        posterUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
      });
    }
    if (headlines.length > 0 || descriptions.length > 0) {
      add({
        creativeId: "text",
        kind: "TEXT",
        title: headlines.length > 0 ? headlines.join("\n") : undefined,
        body: descriptions.length > 0 ? descriptions.join("\n") : undefined,
      });
    }
    return creatives;
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
    const metricFields = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.all_conversions, metrics.conversions_value";
    const resultFields = "segments.conversion_action_category, metrics.all_conversions";

    const listed: ImportedEntity[] = this.parsed(campaignRow, await run(
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

    const enabled = this.parsed(conversionActionRow, await run(
      "SELECT conversion_action.category FROM conversion_action WHERE conversion_action.status = 'ENABLED'",
    )).map(({ conversionAction }) => conversionAction.category);
    const campaignResults = resultsOf(this.parsed(campaignResultRow, await run(
      `SELECT campaign.id, segments.date, ${resultFields} FROM campaign WHERE ${days} AND ${READABLE}`,
    )).map((row) => ({ ...row, id: row.campaign.id })));
    const adSetResults = resultsOf(this.parsed(adGroupResultRow, await run(
      `SELECT ad_group.id, segments.date, ${resultFields} FROM ad_group WHERE ${days} AND ${adGroupScope}`,
    )).map((row) => ({ ...row, id: row.adGroup.id })));
    const adResults = resultsOf(this.parsed(adResultRow, await run(
      `SELECT ad_group_ad.ad.id, segments.date, ${resultFields} FROM ad_group_ad WHERE ${days} AND ${adScope}`,
    )).map((row) => ({ ...row, id: row.adGroupAd.ad.id })));
    const campaigns = listed.map((campaign) => ({
      ...campaign,
      conversionCategories: unique([
        ...enabled,
        ...campaignResults.filter((result) => result.externalId === campaign.id).map((result) => result.category),
      ]).sort(),
    }));

    return { from, to, campaigns, adSets, ads, campaignMetrics, adSetMetrics, adMetrics, campaignResults, adSetResults, adResults };
  }
}
