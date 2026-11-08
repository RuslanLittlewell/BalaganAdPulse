export type ImportStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR" | "AUTH_REQUIRED";
export type CheckStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR";

export interface SeoSite {
  readonly id: string;
  readonly projectId: string;
  readonly siteUrl: string;
  readonly origin: string | null;
  readonly encryptedToken: string;
  readonly revision: string;
  readonly status: string;
  readonly lastSuccessAt: Date | null;
  readonly lastError: string | null;
  readonly nextDailyAt: Date;
  readonly queuedAt: Date | null;
  readonly retryCount: number;
  readonly leaseOwner: string | null;
  readonly leaseUntil: Date | null;
  readonly vitalsReadAt: Date | null;
  readonly checkStatus: string;
  readonly lastCheckAt: Date | null;
  readonly checkError: string | null;
  readonly nextCheckAt: Date;
  readonly checkQueuedAt: Date | null;
  readonly checkLeaseOwner: string | null;
  readonly checkLeaseUntil: Date | null;
  readonly analyticsPropertyId: string | null;
  readonly analyticsName: string | null;
  readonly trafficStatus: string;
  readonly trafficSuccessAt: Date | null;
  readonly trafficError: string | null;
  readonly nextTrafficAt: Date | null;
  readonly trafficQueuedAt: Date | null;
  readonly trafficRetryCount: number;
  readonly trafficLeaseOwner: string | null;
  readonly trafficLeaseUntil: Date | null;
  readonly createdAt: Date;
}

export interface SiteChoice {
  readonly siteUrl: string;
  readonly permissionLevel: string;
}

export type SeoErrorCode = "TOKEN" | "ACCESS" | "PROVIDER" | "INVALID_DATA" | "CONFIGURATION" | "UNREACHABLE" | "ROBOTS";

export class SeoProviderError extends Error {
  constructor(
    readonly code: SeoErrorCode,
    readonly retryAfterMs = 0,
    readonly detail = "",
  ) {
    super(`SEO integration: ${code}`);
  }
}

const DOMAIN_PREFIX = "sc-domain:";

export function isDomainProperty(siteUrl: string): boolean {
  return siteUrl.startsWith(DOMAIN_PREFIX);
}

export function siteLabel(siteUrl: string): string {
  if (isDomainProperty(siteUrl)) return siteUrl.slice(DOMAIN_PREFIX.length);
  if (!URL.canParse(siteUrl)) return siteUrl;
  const url = new URL(siteUrl);
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.host}${path}`;
}

export function homeOf(siteUrl: string): string {
  if (isDomainProperty(siteUrl)) return `https://${siteUrl.slice(DOMAIN_PREFIX.length)}/`;
  return siteUrl;
}

export function originOf(siteUrl: string): string | null {
  if (isDomainProperty(siteUrl)) return null;
  return URL.canParse(siteUrl) ? new URL(siteUrl).origin : null;
}

export function isOnSite(siteUrl: string, address: string): boolean {
  if (!URL.canParse(address)) return false;
  const url = new URL(address);
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (isDomainProperty(siteUrl)) {
    const domain = siteUrl.slice(DOMAIN_PREFIX.length).toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  if (!URL.canParse(siteUrl)) return false;
  const prefix = new URL(siteUrl);
  return url.protocol === prefix.protocol && url.host.toLowerCase() === prefix.host.toLowerCase() && url.pathname.startsWith(prefix.pathname);
}

export function withoutFragment(address: string): string {
  const url = new URL(address);
  url.hash = "";
  return url.toString();
}

export function publicSite(row: SeoSite) {
  return {
    id: row.id,
    siteUrl: row.siteUrl,
    label: siteLabel(row.siteUrl),
    status: row.status,
    lastSuccessAt: row.lastSuccessAt,
    lastError: row.lastError,
    checkStatus: row.checkStatus,
    lastCheckAt: row.lastCheckAt,
    checkError: row.checkError,
    analytics: row.analyticsPropertyId === null
      ? null
      : {
          propertyId: row.analyticsPropertyId,
          name: row.analyticsName ?? row.analyticsPropertyId,
          status: row.trafficStatus,
          lastSuccessAt: row.trafficSuccessAt,
          lastError: row.trafficError,
        },
  };
}

export type PublicSite = ReturnType<typeof publicSite>;
