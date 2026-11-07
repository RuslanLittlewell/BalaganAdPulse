import { withoutFragment } from "./seo-site.js";

export const PAGE_CAP = 500;
export const TITLE_LIMIT = 60;
export const DESCRIPTION_LIMIT = 160;

export const ERROR_KINDS = ["HTTP_ERROR", "UNREACHABLE", "ROBOTS_BLOCKED", "NOINDEX", "TITLE_MISSING", "JSON_LD_INVALID"] as const;
export const WARNING_KINDS = [
  "TITLE_LONG",
  "TITLE_DUPLICATE",
  "DESCRIPTION_MISSING",
  "DESCRIPTION_LONG",
  "DESCRIPTION_DUPLICATE",
  "H1_MISSING",
  "H1_MULTIPLE",
  "CANONICAL_ELSEWHERE",
  "SITEMAP_REDIRECT",
  "JSON_LD_UNTYPED",
] as const;
export const PROBLEM_KINDS = [...ERROR_KINDS, ...WARNING_KINDS] as const;
export type ProblemKind = (typeof PROBLEM_KINDS)[number];
export type Severity = "ERROR" | "WARNING";

export function severityOf(kind: ProblemKind): Severity {
  return (ERROR_KINDS as readonly string[]).includes(kind) ? "ERROR" : "WARNING";
}

export function isProblemKind(value: string): value is ProblemKind {
  return (PROBLEM_KINDS as readonly string[]).includes(value);
}

export interface JsonLdBlock {
  readonly source: string;
  readonly types: readonly string[];
  readonly error: string | null;
}

export interface PageFacts {
  readonly lang: string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly keywords: string | null;
  readonly robots: readonly string[];
  readonly canonical: string | null;
  readonly h1: readonly string[];
  readonly openGraph: Readonly<Record<string, string>>;
  readonly jsonLd: readonly JsonLdBlock[];
}

export type PageOutcome = "FETCHED" | "BLOCKED" | "UNREACHABLE" | "OFF_SITE_REDIRECT";

export interface CheckedPage {
  readonly url: string;
  readonly inSitemap: boolean;
  readonly hasImpressions: boolean;
  readonly outcome: PageOutcome;
  readonly status: number | null;
  readonly finalUrl: string | null;
  readonly contentType: string | null;
  readonly responseMs: number | null;
  readonly facts: PageFacts | null;
}

export interface PageChoice {
  readonly pages: readonly { url: string; inSitemap: boolean; hasImpressions: boolean }[];
  readonly notChecked: number;
}

function normalized(address: string): string | null {
  return URL.canParse(address) ? withoutFragment(address) : null;
}

export function choosePages(input: {
  home: string;
  byImpressions: readonly string[];
  sitemap: readonly string[];
  isOnSite: (address: string) => boolean;
  cap?: number;
}): PageChoice {
  const cap = input.cap ?? PAGE_CAP;
  const inSitemap = new Set<string>();
  const withImpressions = new Set<string>();
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (address: string, mark?: Set<string>) => {
    const url = normalized(address);
    if (!url || !input.isOnSite(url)) return;
    mark?.add(url);
    if (seen.has(url)) return;
    seen.add(url);
    ordered.push(url);
  };
  add(input.home);
  for (const address of input.byImpressions) add(address, withImpressions);
  for (const address of input.sitemap) add(address, inSitemap);
  return {
    pages: ordered.slice(0, cap).map((url) => ({ url, inSitemap: inSitemap.has(url), hasImpressions: withImpressions.has(url) })),
    notChecked: Math.max(0, ordered.length - cap),
  };
}

function isNoindex(facts: PageFacts): boolean {
  return facts.robots.some((directive) => directive === "noindex" || directive === "none");
}

function pointsElsewhere(page: CheckedPage, canonical: string): boolean {
  const base = page.finalUrl ?? page.url;
  if (!URL.canParse(canonical, base)) return false;
  return withoutFragment(new URL(canonical, base).toString()) !== withoutFragment(base);
}

function redirected(page: CheckedPage): boolean {
  return page.outcome === "OFF_SITE_REDIRECT" || (page.finalUrl !== null && page.finalUrl !== page.url);
}

function ownProblems(page: CheckedPage): ProblemKind[] {
  if (page.outcome === "UNREACHABLE") return ["UNREACHABLE"];
  if (page.outcome === "BLOCKED") return page.inSitemap ? ["ROBOTS_BLOCKED"] : [];
  const problems: ProblemKind[] = [];
  if (page.status !== null && page.status >= 400) problems.push("HTTP_ERROR");
  if (redirected(page) && page.inSitemap) problems.push("SITEMAP_REDIRECT");
  const facts = page.facts;
  if (!facts || redirected(page) || page.status !== 200) return problems;
  if (isNoindex(facts) && (page.inSitemap || page.hasImpressions)) problems.push("NOINDEX");
  if (!facts.title) problems.push("TITLE_MISSING");
  else if (facts.title.length > TITLE_LIMIT) problems.push("TITLE_LONG");
  if (!facts.description) problems.push("DESCRIPTION_MISSING");
  else if (facts.description.length > DESCRIPTION_LIMIT) problems.push("DESCRIPTION_LONG");
  if (facts.h1.length === 0) problems.push("H1_MISSING");
  if (facts.h1.length > 1) problems.push("H1_MULTIPLE");
  if (facts.canonical && pointsElsewhere(page, facts.canonical)) problems.push("CANONICAL_ELSEWHERE");
  if (facts.jsonLd.some((block) => block.error !== null)) problems.push("JSON_LD_INVALID");
  if (facts.jsonLd.some((block) => block.error === null && block.types.length === 0)) problems.push("JSON_LD_UNTYPED");
  return problems;
}

function repeated(pages: readonly CheckedPage[], valueOf: (facts: PageFacts) => string | null): Set<string> {
  const byValue = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.facts || page.status !== 200 || redirected(page) || isNoindex(page.facts)) continue;
    const value = valueOf(page.facts);
    if (!value) continue;
    byValue.set(value, [...(byValue.get(value) ?? []), page.url]);
  }
  return new Set([...byValue.values()].filter((urls) => urls.length > 1).flat());
}

export function findProblems(pages: readonly CheckedPage[]): Map<string, ProblemKind[]> {
  const titles = repeated(pages, (facts) => facts.title);
  const descriptions = repeated(pages, (facts) => facts.description);
  return new Map(pages.map((page) => {
    const problems = ownProblems(page);
    if (titles.has(page.url)) problems.push("TITLE_DUPLICATE");
    if (descriptions.has(page.url)) problems.push("DESCRIPTION_DUPLICATE");
    return [page.url, problems];
  }));
}
