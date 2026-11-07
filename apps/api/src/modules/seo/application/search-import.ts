import { homeOf, originOf, SeoProviderError, type SeoSite } from "../domain/seo-site.js";
import { importWindow, type SearchSnapshot, type TopKind, type TopRow } from "../domain/search.js";
import { DEVICES, type VitalReading, type VitalsSnapshot, type VitalWeek } from "../domain/vitals.js";
import type { ChromeUxReport, Cipher, ImportJobs, SearchConsole } from "./ports.js";

const PARALLEL_REQUESTS = 4;
const KEY_LIMIT = 1000;

export interface OriginFinder {
  settle(address: string, siteUrl: string, signal?: AbortSignal): Promise<string | null>;
}

async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...await Promise.all(items.slice(start, start + size).map(work)));
  }
  return results;
}

export async function gatherSearch(
  searchConsole: SearchConsole,
  site: Pick<SeoSite, "siteUrl" | "lastSuccessAt">,
  refreshToken: string,
  today: string,
  signal?: AbortSignal,
): Promise<SearchSnapshot> {
  const access = await searchConsole.accessToken(refreshToken, signal);
  const window = importWindow(today, site.lastSuccessAt === null);
  const days = await searchConsole.totals(access, site.siteUrl, window.from, window.to, signal);
  const topDates = days.filter((day) => day.date >= window.topFrom && day.impressions > 0).map((day) => day.date);
  const requests = topDates.flatMap((date) => (["query", "page"] as const).map((kind) => ({ date, kind })));
  const answers = await inBatches(requests, PARALLEL_REQUESTS, async ({ date, kind }: { date: string; kind: TopKind }) => ({
    kind,
    rows: (await searchConsole.top(access, site.siteUrl, date, kind, signal)).map((row): TopRow => ({ ...row, date, key: row.key.slice(0, KEY_LIMIT) })),
  }));
  return {
    ...window,
    days,
    queries: answers.filter((answer) => answer.kind === "query").flatMap((answer) => answer.rows),
    pages: answers.filter((answer) => answer.kind === "page").flatMap((answer) => answer.rows),
  };
}

export async function gatherVitals(crux: ChromeUxReport, origin: string, signal?: AbortSignal): Promise<VitalsSnapshot> {
  const readings: VitalReading[] = [];
  const weeks: VitalWeek[] = [];
  for (const device of DEVICES) {
    readings.push(...await crux.current(origin, device, signal));
    weeks.push(...await crux.history(origin, device, signal));
  }
  return { readings, weeks };
}

export function createSearchImport(d: {
  jobs: ImportJobs;
  cipher: Cipher;
  console: SearchConsole | null;
  crux: ChromeUxReport | null;
  origins: OriginFinder;
  clock: { now(): Date };
}) {
  const readVitals = async (job: SeoSite, signal: AbortSignal) => {
    if (!d.crux) return;
    try {
      const origin = job.origin ?? originOf(job.siteUrl) ?? await d.origins.settle(homeOf(job.siteUrl), job.siteUrl, signal);
      if (!origin) return;
      const vitals = await gatherVitals(d.crux, origin, signal);
      if (!signal.aborted) await d.jobs.saveVitals(job, origin, vitals, d.clock.now());
    } catch (error) {
      console.error("Core Web Vitals import failed:", error instanceof SeoProviderError ? `${error.code} ${error.detail}` : error instanceof Error ? error.message : error);
    }
  };

  return async (job: SeoSite, signal: AbortSignal): Promise<void> => {
    try {
      await readVitals(job, signal);
      if (job.status === "AUTH_REQUIRED") {
        await d.jobs.release(job, d.clock.now());
        return;
      }
      if (!d.console) throw new SeoProviderError("CONFIGURATION");
      const refreshToken = d.cipher.decrypt(job.encryptedToken, job.projectId);
      const today = d.clock.now().toISOString().slice(0, 10);
      const snapshot = await gatherSearch(d.console, job, refreshToken, today, signal);
      if (signal.aborted) return;
      await d.jobs.complete(job, snapshot, d.clock.now());
    } catch (error) {
      const failure = error instanceof SeoProviderError ? error : new SeoProviderError("PROVIDER", 0, error instanceof Error ? error.message : "unknown");
      console.error("Search Console import failed:", failure.code, failure.detail);
      await d.jobs.fail(job, failure.code, failure.retryAfterMs, d.clock.now());
    }
  };
}
