import type { ActorContext, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import type { SeoSite, SiteChoice } from "../domain/seo-site.js";
import type { SearchDay, SearchSnapshot, TopKind, TopRow } from "../domain/search.js";
import type { Device, LabMeasurement, VitalReading, VitalsSnapshot, VitalWeek } from "../domain/vitals.js";
import type { ChannelTotal, DayTotal, PropertyChoice, SourceTotal, TrafficSnapshot } from "../domain/traffic.js";
import type { CheckedPage, PageFacts, ProblemKind } from "../domain/page-audit.js";

export type UnreachableReason = "REFUSED_ADDRESS" | "TIMEOUT" | "NETWORK" | "TOO_MANY_REDIRECTS" | "BAD_ADDRESS";

export type FetchOutcome =
  | {
      readonly kind: "response";
      readonly status: number;
      readonly finalUrl: string;
      readonly contentType: string | null;
      readonly headers: Readonly<Record<string, string | string[] | undefined>>;
      readonly body: Buffer;
      readonly ms: number;
    }
  | { readonly kind: "off-site"; readonly status: number; readonly location: string; readonly ms: number }
  | { readonly kind: "unreachable"; readonly reason: UnreachableReason; readonly ms: number };

export interface PageFetcher {
  fetch(address: string, isAllowed: (address: string) => boolean, options?: { maxBytes?: number }): Promise<FetchOutcome>;
}

export interface PageParser {
  facts(outcome: Extract<FetchOutcome, { kind: "response" }>): PageFacts | null;
}

export interface SitemapParser {
  parse(body: Buffer): { sitemaps: string[]; pages: string[] };
}

export interface SignInRecord {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly integrationId: string | null;
  readonly purpose: string;
  readonly encryptedRefreshToken: string | null;
}

export interface SignIns {
  open(data: { projectId: string; userId: string; integrationId: string | null; purpose: "SEARCH_CONSOLE" | "SITE_ANALYTICS" }, now: Date, expiresAt: Date): Promise<SignInRecord>;
  read(id: string, now: Date): Promise<SignInRecord | null>;
  close(id: string): Promise<void>;
}

export interface Cipher {
  encrypt(token: string, projectId: string): string;
  decrypt(value: string, projectId: string): string;
}

export interface SearchConsole {
  consentUrl(state: string): string;
  accessToken(refreshToken: string, signal?: AbortSignal): Promise<string>;
  sites(accessToken: string, signal?: AbortSignal): Promise<SiteChoice[]>;
  totals(accessToken: string, siteUrl: string, from: string, to: string, signal?: AbortSignal): Promise<SearchDay[]>;
  top(accessToken: string, siteUrl: string, date: string, kind: TopKind, signal?: AbortSignal): Promise<Omit<TopRow, "date">[]>;
  sitemaps(accessToken: string, siteUrl: string, signal?: AbortSignal): Promise<string[]>;
}

export interface Analytics {
  consentUrl(state: string): string;
  accessToken(refreshToken: string, signal?: AbortSignal): Promise<string>;
  properties(accessToken: string, signal?: AbortSignal): Promise<PropertyChoice[]>;
  sessions(accessToken: string, propertyId: string, from: string, to: string, signal?: AbortSignal): Promise<TrafficSnapshot["rows"]>;
}

export interface ChromeUxReport {
  current(origin: string, device: Device, signal?: AbortSignal): Promise<VitalReading[]>;
  history(origin: string, device: Device, signal?: AbortSignal): Promise<VitalWeek[]>;
}

export interface PageSpeed {
  measure(url: string, device: Device, signal?: AbortSignal): Promise<LabMeasurement>;
}

export interface NewSite {
  readonly projectId: string;
  readonly siteUrl: string;
  readonly encryptedToken: string;
  readonly analytics?: { readonly propertyId: string; readonly name: string };
}

export interface SiteRepository {
  list(projectId: string): Promise<SeoSite[]>;
  read(projectId: string, id: string): Promise<SeoSite | null>;
  add(context: TransactionContext, site: NewSite, now: Date): Promise<SeoSite>;
  renew(context: TransactionContext, id: string, encryptedToken: string, now: Date): Promise<SeoSite>;
  remove(context: TransactionContext, id: string): Promise<void>;
  linkAnalytics(context: TransactionContext, id: string, link: { encryptedToken: string; propertyId: string; name: string }, now: Date): Promise<SeoSite>;
  unlinkAnalytics(context: TransactionContext, id: string): Promise<void>;
  queueTraffic(id: string, now: Date): Promise<void>;
  queueImport(id: string, now: Date): Promise<void>;
  queueCheck(id: string, now: Date): Promise<void>;
}

export interface ImportJobs {
  claim(now: Date): Promise<SeoSite | null>;
  renew(job: SeoSite, now: Date): Promise<boolean>;
  saveVitals(job: SeoSite, origin: string, vitals: VitalsSnapshot, now: Date): Promise<boolean>;
  complete(job: SeoSite, snapshot: SearchSnapshot, now: Date): Promise<boolean>;
  release(job: SeoSite, now: Date): Promise<void>;
  fail(job: SeoSite, code: string, retryAfterMs: number, now: Date): Promise<void>;
}

export interface TrafficJobs {
  claim(now: Date): Promise<SeoSite | null>;
  renew(job: SeoSite, now: Date): Promise<boolean>;
  complete(job: SeoSite, snapshot: TrafficSnapshot, now: Date): Promise<boolean>;
  release(job: SeoSite, now: Date): Promise<void>;
  fail(job: SeoSite, code: string, retryAfterMs: number, now: Date): Promise<void>;
}

export interface CheckResult {
  readonly pages: readonly CheckedPage[];
  readonly problems: ReadonlyMap<string, readonly ProblemKind[]>;
  readonly notChecked: number;
  readonly labs: readonly LabMeasurement[];
}

export interface CheckJobs {
  claim(now: Date): Promise<SeoSite | null>;
  renew(job: SeoSite, now: Date): Promise<boolean>;
  impressionPages(siteId: string, from: string): Promise<string[]>;
  complete(job: SeoSite, result: CheckResult, now: Date): Promise<boolean>;
  fail(job: SeoSite, code: string, now: Date): Promise<void>;
}

export interface StoredLab extends LabMeasurement {
  readonly measuredAt: Date;
}

export interface TopTotal {
  readonly key: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly position: number;
}

export interface StoredAudit {
  readonly finishedAt: Date;
  readonly checked: number;
  readonly notChecked: number;
  readonly problems: readonly (readonly string[])[];
}

export interface StoredAuditPage {
  readonly id: string;
  readonly url: string;
  readonly status: number | null;
  readonly finalUrl: string | null;
  readonly contentType: string | null;
  readonly responseMs: number | null;
  readonly inSitemap: boolean;
  readonly hasImpressions: boolean;
  readonly outcome: string;
  readonly facts: PageFacts | null;
  readonly problems: readonly string[];
}

export interface SeoReads {
  days(siteId: string, from: string, to: string): Promise<SearchDay[]>;
  latestDay(siteId: string): Promise<string | null>;
  earliestTopDay(siteId: string, kind: TopKind): Promise<string | null>;
  top(siteId: string, kind: TopKind, from: string, to: string, limit: number, keys?: readonly string[]): Promise<TopTotal[]>;
  vitals(siteId: string): Promise<VitalReading[]>;
  weeks(siteId: string, from: string, to: string): Promise<VitalWeek[]>;
  labs(siteId: string): Promise<StoredLab[]>;
  trafficChannels(siteId: string, from: string, to: string): Promise<ChannelTotal[]>;
  trafficSources(siteId: string, from: string, to: string, limit: number): Promise<SourceTotal[]>;
  trafficDays(siteId: string, from: string, to: string): Promise<DayTotal[]>;
  audit(siteId: string): Promise<StoredAudit | null>;
  auditPages(siteId: string, kind: string | null): Promise<StoredAuditPage[]>;
  auditPage(siteId: string, pageId: string): Promise<StoredAuditPage | null>;
}

export interface ProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string } | null>;
}

export interface SeoDependencies {
  sites: SiteRepository;
  signIns: SignIns;
  cipher: Cipher;
  console: SearchConsole | null;
  analytics: Analytics | null;
  projects: ProjectReach;
  clock: { now(): Date };
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}
