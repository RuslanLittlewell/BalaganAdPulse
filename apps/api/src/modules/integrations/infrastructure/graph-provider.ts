import { z } from "zod";
import type { AccountProvider } from "../application/ports.js";
import { MetaError } from "../domain/integration.js";
import type { ImportedCreative, ImportedEntity, ImportedMetric, ImportedStatus, Snapshot } from "../domain/snapshot.js";
import { localDate, shiftDate } from "../application/schedule.js";

const id = z.string().regex(/^\d+$/);
const money = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/);
const count = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647));
const entity = z.object({ id, name: z.string().min(1), effective_status: z.string(), campaign_id: id.optional(), adset_id: id.optional(), objective: z.string().optional() });
const action = z.object({ action_type: z.string(), value: z.string() });
const metric = z.object({ campaign_id: id, adset_id: id.optional(), ad_id: id.optional(), date_start: z.iso.date(), spend: money.default("0"), impressions: count.default(0), reach: count.default(0), clicks: count.default(0), actions: z.array(action).default([]), action_values: z.array(action).default([]) });
const link = z.string().min(1).max(2048);
const attachment = z.object({ picture: link.optional(), video_id: id.optional(), name: z.string().optional(), description: z.string().optional() });
const assetFeed = z.object({
  videos: z.array(z.object({ video_id: id.optional(), thumbnail_url: link.optional() })).optional(),
  images: z.array(z.object({ hash: z.string().min(1).max(200).optional(), url: link.optional() })).optional(),
});
const creative = z.object({
  id: z.string().min(1),
  asset_feed_spec: assetFeed.optional(),
  image_url: link.optional(),
  image_hash: z.string().min(1).max(200).optional(),
  thumbnail_url: link.optional(),
  video_id: id.optional(),
  object_story_spec: z.object({
    link_data: z.object({ name: z.string().optional(), message: z.string().optional(), picture: link.optional(), child_attachments: z.array(attachment).optional() }).optional(),
    video_data: z.object({ video_id: id.optional(), image_url: link.optional(), title: z.string().optional(), message: z.string().optional() }).optional(),
  }).optional(),
});
const video = z.object({ id, source: link.optional(), picture: link.optional() });
const THUMBNAIL = { thumbnail_width: "1080", thumbnail_height: "1080" };

type PendingCreative = ImportedCreative & { videoId?: string; imageHash?: string };

const CREATIVE_FIELDS = "creative{id,thumbnail_url,image_url,image_hash,video_id,object_story_spec,asset_feed_spec}";
const LIGHT_CREATIVE_FIELDS = "creative{id,thumbnail_url,image_url,image_hash,video_id}";
const MAX_VIDEO_LOOKUPS = 200;
const IMAGE_BATCH = 50;
const PREVIEW_FORMAT = "MOBILE_FEED_STANDARD";

function distinctBy<T>(assets: readonly T[], key: (asset: T) => string | undefined): T[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const value = key(asset);
    if (value === undefined) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function describe(adExternalId: string, row: unknown): PendingCreative[] {
  const parsed = creative.safeParse((row as { creative?: unknown }).creative);
  if (!parsed.success) return [];
  const value = parsed.data;
  const story = value.object_story_spec;
  const linkData = story?.link_data;
  const videoData = story?.video_data;
  const base = {
    adExternalId,
    creativeId: value.id,
    title: linkData?.name ?? videoData?.title,
    body: linkData?.message ?? videoData?.message,
  };
  const frames = linkData?.child_attachments ?? [];
  if (frames.length > 0) {
    return frames.map((frame, position) => frame.video_id
      ? { ...base, position, kind: "VIDEO" as const, videoId: frame.video_id, posterUrl: frame.picture }
      : { ...base, position, kind: "IMAGE" as const, fileUrl: frame.picture })
      .filter((entry) => entry.kind === "VIDEO" || entry.fileUrl !== undefined);
  }
  const feed = value.asset_feed_spec;
  const feedVideos = distinctBy(feed?.videos ?? [], (asset) => asset.video_id);
  if (feedVideos.length > 0) {
    return feedVideos.map((asset, position) => ({
      ...base, position, kind: "VIDEO" as const,
      videoId: asset.video_id, posterUrl: asset.thumbnail_url,
    }));
  }
  const feedImages = distinctBy(
    (feed?.images ?? []).filter((asset) => asset.url !== undefined || asset.hash !== undefined),
    (asset) => asset.hash ?? asset.url,
  );
  if (feedImages.length > 0) {
    return feedImages.map((asset, position) => ({
      ...base, position, kind: "IMAGE" as const,
      fileUrl: asset.url, imageHash: asset.hash,
    }));
  }

  const videoId = value.video_id ?? videoData?.video_id;
  if (videoId) {
    return [{
      ...base, position: 0, kind: "VIDEO", videoId,
      posterUrl: value.image_url ?? value.thumbnail_url ?? videoData?.image_url,
    }];
  }
  const picture = value.image_url ?? linkData?.picture ?? videoData?.image_url;
  if (picture) return [{ ...base, position: 0, kind: "IMAGE", fileUrl: picture }];
  if (value.image_hash) {
    return [{ ...base, position: 0, kind: "IMAGE", imageHash: value.image_hash, fileUrl: value.thumbnail_url }];
  }
  return value.thumbnail_url
    ? [{ ...base, position: 0, kind: "IMAGE", fileUrl: value.thumbnail_url }]
    : [];
}

const statuses: Record<string, ImportedStatus> = { ACTIVE: "ACTIVE", PAUSED: "PAUSED", CAMPAIGN_PAUSED: "PAUSED", ADSET_PAUSED: "PAUSED", ARCHIVED: "ENDED", DELETED: "ENDED", DISAPPROVED: "REJECTED", PENDING_REVIEW: "LEARNING", PREAPPROVED: "LEARNING", PENDING_BILLING_INFO: "LEARNING", IN_PROCESS: "LEARNING", WITH_ISSUES: "REJECTED" };

export class GraphProvider implements AccountProvider {
  constructor(private readonly version = "v22.0", private readonly fetcher: typeof fetch = fetch, private readonly requestTimeoutMs = 30_000) {}

  private async request(path: string, token: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    if (!/^v\d+\.0$/.test(this.version)) throw new MetaError("CONFIGURATION");
    const url = new URL(`https://graph.facebook.com/${this.version}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    try {
      const timeout = AbortSignal.timeout(this.requestTimeoutMs);
      const response = await this.fetcher(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      const reader = response.body?.getReader();
      if (!reader) throw new MetaError("INVALID_DATA");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5_000_000) { await reader.cancel(); throw new MetaError("INVALID_DATA"); }
        chunks.push(value);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!response.ok || body.error) {
        const code = body.error?.code;
        const detail = `http ${response.status}, code ${code ?? "none"}, type ${body.error?.type ?? "none"}`;
        if ([190, 102, 10, 200].includes(code)) throw new MetaError("TOKEN", 0, detail);
        const retry = response.headers.get("retry-after");
        const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 0;
        throw new MetaError(response.status === 429 || response.status >= 500 || body.error?.is_transient || [4, 17, 32, 613].includes(code) ? "PROVIDER" : "INVALID_DATA", Number.isFinite(delay) ? delay : 0, detail);
      }
      return body;
    } catch (error) {
      if (error instanceof MetaError) throw error;
      throw new MetaError("PROVIDER", 0, error instanceof Error ? error.message : "unknown");
    }
  }

  private async pages(path: string, token: string, params: Record<string, string>, signal?: AbortSignal, limit = 500): Promise<unknown[]> {
    const rows: unknown[] = [];
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < 200; page++) {
      const result = z.object({ data: z.array(z.unknown()), paging: z.object({ next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional() }).optional() }).safeParse(await this.request(path, token, { ...params, limit: String(limit), ...(after ? { after } : {}) }, signal));
      if (!result.success) throw new MetaError("INVALID_DATA");
      rows.push(...result.data.data);
      if (rows.length > 100_000) throw new MetaError("INVALID_DATA");
      if (!result.data.paging?.next) return rows;
      after = result.data.paging.cursors?.after;
      if (!after || cursors.has(after)) throw new MetaError("INVALID_DATA");
      cursors.add(after);
    }
    throw new MetaError("INVALID_DATA");
  }

  async account(accountId: string, token: string, signal?: AbortSignal) {
    if (!/^\d{1,30}$/.test(accountId)) throw new MetaError("INVALID_DATA");
    const result = z.object({ account_id: id, currency: z.string(), timezone_name: z.string() }).safeParse(await this.request(`act_${accountId}`, token, { fields: "account_id,currency,timezone_name" }, signal));
    if (!result.success || result.data.account_id !== accountId) throw new MetaError("INVALID_DATA");
    try { localDate(new Date(), result.data.timezone_name); } catch { throw new MetaError("INVALID_DATA"); }
    return { accountId, currency: result.data.currency, timezone: result.data.timezone_name };
  }

  private async entities(accountId: string, token: string, edge: "campaigns" | "adsets" | "ads", signal?: AbortSignal): Promise<ImportedEntity[]> {
    const parent = edge === "adsets" ? "campaign_id" : edge === "ads" ? "adset_id" : "objective";
    const rows = await this.pages(`act_${accountId}/${edge}`, token, { fields: `id,name,effective_status,${parent}` }, signal);
    return rows.map((row) => {
      const result = entity.safeParse(row);
      if (!result.success || !Object.hasOwn(statuses, result.data.effective_status)) throw new MetaError("INVALID_DATA");
      const value = result.data;
      const parentId = edge === "adsets" ? value.campaign_id : value.adset_id;
      if (edge !== "campaigns" && !parentId) throw new MetaError("INVALID_DATA");
      return { id: value.id, name: value.name, status: statuses[value.effective_status], parentId, objective: value.objective };
    });
  }
  campaigns(accountId: string, token: string, signal?: AbortSignal) { return this.entities(accountId, token, "campaigns", signal); }

  async preview(adExternalId: string, token: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const answer = z.object({ data: z.array(z.object({ body: z.string() })) })
        .safeParse(await this.request(`${adExternalId}/previews`, token, { ad_format: PREVIEW_FORMAT }, signal));
      if (!answer.success) return null;
      const frame = /<iframe[^>]+src="([^"]+)"/.exec(answer.data.data[0]?.body ?? "");
      if (!frame) return null;
      const address = frame[1].replaceAll("&amp;", "&");
      return address.startsWith("https://") ? address : null;
    } catch {
      return null;
    }
  }

  private async video(
    videoId: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<{ source?: string; picture?: string }> {
    try {
      const result = video.safeParse(await this.request(videoId, token, { fields: "source,picture" }, signal));
      return result.success ? { source: result.data.source, picture: result.data.picture } : {};
    } catch {
      return {};
    }
  }

  private async creativeOf(adId: string, token: string, signal?: AbortSignal): Promise<unknown | null> {
    try {
      return await this.request(adId, token, { fields: `id,${CREATIVE_FIELDS}`, ...THUMBNAIL }, signal);
    } catch {
      try {
        return await this.request(adId, token, { fields: `id,${LIGHT_CREATIVE_FIELDS}`, ...THUMBNAIL }, signal);
      } catch {
        return null;
      }
    }
  }

  async adCreatives(
    adExternalId: string,
    token: string,
    accountId?: string,
    signal?: AbortSignal,
  ): Promise<ImportedCreative[]> {
    const row = await this.creativeOf(adExternalId, token, signal);
    return row ? this.resolve(describe(adExternalId, row), token, signal, accountId) : [];
  }

  private async resolve(
    pending: readonly PendingCreative[],
    token: string,
    signal?: AbortSignal,
    accountId?: string,
  ): Promise<ImportedCreative[]> {
    const videos = new Map<string, { source?: string; picture?: string }>();
    for (const videoId of [...new Set(pending.flatMap((entry) => entry.videoId ? [entry.videoId] : []))].slice(0, MAX_VIDEO_LOOKUPS)) {
      videos.set(videoId, await this.video(videoId, token, signal));
    }
    const hashes = [...new Set(pending.flatMap((entry) => entry.imageHash ? [entry.imageHash] : []))];
    const originals = accountId && hashes.length > 0
      ? await this.originals(accountId, token, hashes, signal)
      : new Map<string, string>();

    return pending.map(({ videoId, imageHash, ...entry }) => {
      if (videoId) {
        const found = videos.get(videoId) ?? {};
        return { ...entry, fileUrl: found.source, posterUrl: found.picture ?? entry.posterUrl };
      }
      if (imageHash) return { ...entry, fileUrl: originals.get(imageHash) ?? entry.fileUrl };
      return entry;
    });
  }

  private async metrics(accountId: string, token: string, level: "campaign" | "adset" | "ad", from: string, to: string, signal?: AbortSignal): Promise<ImportedMetric[]> {
    const rows = await this.pages(`act_${accountId}/insights`, token, { level, time_increment: "1", time_range: JSON.stringify({ since: from, until: to }), fields: [...new Set([`${level}_id`, "campaign_id", "date_start", "spend", "impressions", "reach", "clicks", "actions", "action_values"])].join(",") }, signal);
    const seen = new Set<string>();
    return rows.map((row) => {
      const parsed = metric.safeParse(row);
      if (!parsed.success) throw new MetaError("INVALID_DATA");
      const data = parsed.data;
      const externalId = data[`${level}_id`];
      if (!externalId || data.date_start < from || data.date_start > to) throw new MetaError("INVALID_DATA");
      const key = `${externalId}/${data.date_start}`;
      if (seen.has(key)) throw new MetaError("INVALID_DATA");
      seen.add(key);
      const conversions = count.safeParse(data.actions.find((item) => item.action_type === "lead")?.value ?? "0");
      const revenue = money.safeParse(data.action_values.find((item) => item.action_type === "purchase")?.value ?? "0");
      if (!conversions.success || !revenue.success) throw new MetaError("INVALID_DATA");
      return { externalId, date: data.date_start, spend: data.spend, impressions: data.impressions, reach: data.reach, clicks: data.clicks, conversions: conversions.data, revenue: revenue.data };
    });
  }

  private async originals(
    accountId: string,
    token: string,
    hashes: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (let i = 0; i < hashes.length; i += IMAGE_BATCH) {
      try {
        const rows = await this.pages(`act_${accountId}/adimages`, token, {
          fields: "hash,url",
          hashes: JSON.stringify(hashes.slice(i, i + IMAGE_BATCH)),
        }, signal, IMAGE_BATCH);
        for (const row of rows) {
          const parsed = z.object({ hash: z.string(), url: link }).safeParse(row);
          if (parsed.success) found.set(parsed.data.hash, parsed.data.url);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        console.error("Meta creative originals refused:", error instanceof MetaError ? `${error.code} ${error.detail}` : error);
        return found;
      }
    }
    return found;
  }

  async snapshot(accountId: string, token: string, currency: string, now: Date, signal?: AbortSignal): Promise<Snapshot> {
    const account = await this.account(accountId, token, signal);
    if (account.currency !== currency) throw new MetaError("CURRENCY");
    const today = localDate(now, account.timezone);
    const from = shiftDate(today, -30);
    const to = shiftDate(today, -1);
    const campaigns = await this.entities(accountId, token, "campaigns", signal);
    const adSets = await this.entities(accountId, token, "adsets", signal);
    const ads = await this.entities(accountId, token, "ads", signal);
    const campaignMetrics = await this.metrics(accountId, token, "campaign", from, to, signal);
    const adSetMetrics = await this.metrics(accountId, token, "adset", from, to, signal);
    const adMetrics = await this.metrics(accountId, token, "ad", from, to, signal);
    return { from, to, campaigns, adSets, ads, campaignMetrics, adSetMetrics, adMetrics };
  }
}
