import { homeOf, isOnSite, SeoProviderError, withoutFragment, type SeoSite } from "../domain/seo-site.js";
import { ALLOW_ALL, isAllowed, parseRobots, type RobotsRules } from "../domain/robots.js";
import { choosePages, findProblems, type CheckedPage } from "../domain/page-audit.js";
import { IMPRESSION_DAYS, shiftDate } from "../domain/search.js";
import { DEVICES, type LabMeasurement } from "../domain/vitals.js";
import type { CheckJobs, CheckResult, Cipher, FetchOutcome, PageFetcher, PageParser, PageSpeed, SearchConsole, SitemapParser } from "./ports.js";

const PAGE_GAP_MS = 1000;
const SITEMAP_FILES = 50;
const SITEMAP_DEPTH = 2;
const SITEMAP_BYTES = 10_000_000;
const ROBOTS_BYTES = 500_000;

export interface PageCheckDependencies {
  jobs: CheckJobs;
  fetcher: PageFetcher;
  pages: PageParser;
  sitemaps: SitemapParser;
  console: SearchConsole | null;
  cipher: Cipher;
  pageSpeed: PageSpeed | null;
  clock: { now(): Date };
  pause(ms: number): Promise<void>;
  budgetMs: number;
}

type Robots = RobotsRules | "UNAVAILABLE";

function checkedPage(page: { url: string; inSitemap: boolean; hasImpressions: boolean }, outcome: FetchOutcome, parser: PageParser): CheckedPage {
  const base = { ...page, contentType: null, facts: null };
  if (outcome.kind === "unreachable") return { ...base, outcome: "UNREACHABLE", status: null, finalUrl: null, responseMs: outcome.ms };
  if (outcome.kind === "off-site") return { ...base, outcome: "OFF_SITE_REDIRECT", status: outcome.status, finalUrl: outcome.location, responseMs: outcome.ms };
  return {
    ...page,
    outcome: "FETCHED",
    status: outcome.status,
    finalUrl: outcome.finalUrl,
    contentType: outcome.contentType,
    responseMs: outcome.ms,
    facts: outcome.status < 400 ? parser.facts(outcome) : null,
  };
}

export function createPageCheck(d: PageCheckDependencies) {
  const check = async (job: SeoSite, signal: AbortSignal): Promise<CheckResult> => {
    const started = d.clock.now().getTime();
    const onSite = (address: string) => isOnSite(job.siteUrl, address);
    let lastFetch = 0;
    const paced = async (address: string, maxBytes?: number) => {
      const wait = lastFetch + PAGE_GAP_MS - d.clock.now().getTime();
      if (lastFetch > 0 && wait > 0) await d.pause(wait);
      lastFetch = d.clock.now().getTime();
      return d.fetcher.fetch(address, onSite, maxBytes ? { maxBytes } : {});
    };

    const robotsByOrigin = new Map<string, Robots>();
    const robotsFor = async (origin: string): Promise<Robots> => {
      const known = robotsByOrigin.get(origin);
      if (known) return known;
      const outcome = await paced(`${origin}/robots.txt`, ROBOTS_BYTES);
      const robots: Robots = outcome.kind !== "response"
        ? (outcome.kind === "off-site" ? ALLOW_ALL : "UNAVAILABLE")
        : outcome.status >= 500
          ? "UNAVAILABLE"
          : outcome.status >= 400 ? ALLOW_ALL : parseRobots(outcome.body.toString("utf8"));
      robotsByOrigin.set(origin, robots);
      return robots;
    };

    const homeAddress = homeOf(job.siteUrl);
    const home = await paced(homeAddress);
    const homeUrl = home.kind === "response" ? home.finalUrl : homeAddress;
    const homeOrigin = new URL(homeUrl).origin;
    const homeRobots = await robotsFor(homeOrigin);
    if (home.kind === "unreachable" && homeRobots === "UNAVAILABLE") throw new SeoProviderError("UNREACHABLE", 0, home.reason);
    if (homeRobots === "UNAVAILABLE") throw new SeoProviderError("ROBOTS");

    const submitted = await (async () => {
      if (!d.console || job.status === "AUTH_REQUIRED") return [];
      try {
        const access = await d.console.accessToken(d.cipher.decrypt(job.encryptedToken, job.projectId), signal);
        return await d.console.sitemaps(access, job.siteUrl, signal);
      } catch {
        return [];
      }
    })();

    const sitemapPages: string[] = [];
    const queue = [...homeRobots.sitemaps, `${homeOrigin}/sitemap.xml`, ...submitted].map((address) => ({ address, depth: 0 }));
    const readSitemaps = new Set<string>();
    while (queue.length > 0 && readSitemaps.size < SITEMAP_FILES && !signal.aborted) {
      const { address, depth } = queue.shift()!;
      if (readSitemaps.has(address) || !onSite(address)) continue;
      readSitemaps.add(address);
      const outcome = await paced(address, SITEMAP_BYTES);
      if (outcome.kind !== "response" || outcome.status >= 400) continue;
      try {
        const found = d.sitemaps.parse(outcome.body);
        sitemapPages.push(...found.pages);
        if (depth < SITEMAP_DEPTH) queue.push(...found.sitemaps.map((next) => ({ address: next, depth: depth + 1 })));
      } catch {
        continue;
      }
    }

    const today = d.clock.now().toISOString().slice(0, 10);
    const byImpressions = await d.jobs.impressionPages(job.id, shiftDate(today, -IMPRESSION_DAYS));
    const homePage = withoutFragment(homeUrl);
    const choice = choosePages({ home: homePage, byImpressions, sitemap: sitemapPages, isOnSite: onSite });

    const pages: CheckedPage[] = [];
    let notChecked = choice.notChecked;
    for (const [index, page] of choice.pages.entries()) {
      if (signal.aborted) throw new SeoProviderError("PROVIDER", 0, "aborted");
      if (d.clock.now().getTime() - started > d.budgetMs) {
        notChecked += choice.pages.length - index;
        break;
      }
      if (page.url === homePage) {
        pages.push(checkedPage(page, home, d.pages));
        continue;
      }
      const robots = await robotsFor(new URL(page.url).origin);
      if (robots === "UNAVAILABLE") {
        pages.push(checkedPage(page, { kind: "unreachable", reason: "NETWORK", ms: 0 }, d.pages));
        continue;
      }
      if (!isAllowed(robots, page.url)) {
        pages.push({ ...page, outcome: "BLOCKED", status: null, finalUrl: null, contentType: null, responseMs: null, facts: null });
        continue;
      }
      pages.push(checkedPage(page, await paced(page.url), d.pages));
    }

    const labs: LabMeasurement[] = [];
    if (d.pageSpeed) {
      for (const device of DEVICES) {
        try {
          labs.push(await d.pageSpeed.measure(homeUrl, device, signal));
        } catch (error) {
          console.error("PageSpeed measurement failed:", error instanceof SeoProviderError ? error.code : error instanceof Error ? error.message : error);
        }
      }
    }
    return { pages, problems: findProblems(pages), notChecked, labs };
  };

  return async (job: SeoSite, signal: AbortSignal): Promise<void> => {
    try {
      const result = await check(job, signal);
      if (signal.aborted) return;
      await d.jobs.complete(job, result, d.clock.now());
    } catch (error) {
      const code = error instanceof SeoProviderError ? error.code : "PROVIDER";
      console.error("Page check failed:", code, error instanceof Error ? error.message : error);
      await d.jobs.fail(job, code, d.clock.now());
    }
  };
}
