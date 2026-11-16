import type { LeadAnswer } from './lead.js';

export const WEBSITE_KEY = /^bk_[A-Za-z0-9_-]{32}$/;
export const WEBSITE_SITE_LIMIT = 20;
export const DEFAULT_WEBSITE_LEAD_NAME = 'Заявка с сайта';

export interface WebsiteKey {
  key: string;
  allowedSites: string[];
  createdAt: Date;
  rotatedAt: Date | null;
}

export interface LiveWebsiteKey {
  projectId: string;
  orgId: string;
  allowedSites: string[];
}

export interface UtmTags {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface WebsiteLead extends UtmTags {
  externalId: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  pageUrl: string | null;
  referrer: string | null;
  answers: LeadAnswer[];
}

export function hostOf(value: string): string | null {
  const text = value.trim();
  if (text === '') return null;
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase();
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function siteAllowed(allowedSites: readonly string[], origin: string | undefined): boolean {
  const host = origin ? hostOf(origin) : null;
  return host !== null && allowedSites.some((site) => host === site || host.endsWith(`.${site}`));
}

export function leadNameOf(lead: Pick<WebsiteLead, 'name' | 'phone' | 'email'>): string {
  return lead.name?.trim() || lead.phone?.trim() || lead.email?.trim() || DEFAULT_WEBSITE_LEAD_NAME;
}

export function sameCampaignName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
