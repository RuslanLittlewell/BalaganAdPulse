import { describe, expect, it, vi } from "vitest";
import { createSearchImport, gatherSearch } from "../../src/modules/seo/application/search-import.js";
import { SeoProviderError, type SeoSite } from "../../src/modules/seo/domain/seo-site.js";
import { importWindow, previousPeriod, totalsOf } from "../../src/modules/seo/domain/search.js";
import { passes, rate, rateScore } from "../../src/modules/seo/domain/vitals.js";

const NOW = new Date("2026-11-07T06:00:00Z");

const site = (over: Partial<SeoSite> = {}): SeoSite => ({
  id: "s1", projectId: "p1", siteUrl: "https://shop.ru/", origin: null, encryptedToken: "enc(refresh)", revision: "v1",
  status: "RUNNING", lastSuccessAt: null, lastError: null, nextDailyAt: NOW, queuedAt: null, retryCount: 0,
  leaseOwner: "me", leaseUntil: NOW, vitalsReadAt: null, checkStatus: "SUCCESS", lastCheckAt: null, checkError: null,
  nextCheckAt: NOW, checkQueuedAt: null, checkLeaseOwner: null, checkLeaseUntil: null, createdAt: NOW,
  ...over,
});

function searchConsole() {
  return {
    consentUrl: vi.fn(),
    accessToken: vi.fn(async () => "access"),
    sites: vi.fn(),
    totals: vi.fn(async () => [
      { date: "2026-11-04", clicks: 5, impressions: 100, position: 3 },
      { date: "2026-11-05", clicks: 0, impressions: 0, position: 0 },
    ]),
    top: vi.fn(async (_access: string, _site: string, date: string, kind: string) => [{ key: `${kind}-${date}`, clicks: 1, impressions: 10, position: 2 }]),
    sitemaps: vi.fn(),
  };
}

function fixture(options: { crux?: boolean; console?: ReturnType<typeof searchConsole> | null } = {}) {
  const jobs = {
    claim: vi.fn(), renew: vi.fn(),
    saveVitals: vi.fn(async () => true),
    complete: vi.fn(async () => true),
    release: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  };
  const crux = {
    current: vi.fn(async (_origin: string, device: "PHONE" | "DESKTOP") =>
      device === "PHONE" ? [{ device, metric: "LCP" as const, periodEnd: "2026-11-05", p75: 2100, good: 0.8, needsImprovement: 0.15, poor: 0.05 }] : []),
    history: vi.fn(async () => []),
  };
  const origins = { settle: vi.fn(async () => "https://www.site.ru") };
  const consoleFake = options.console === undefined ? searchConsole() : options.console;
  const run = createSearchImport({
    jobs,
    cipher: { encrypt: (token) => token, decrypt: (value) => value.replace(/^enc\((.*)\)$/, "$1") },
    console: consoleFake,
    crux: options.crux === false ? null : crux,
    origins,
    clock: { now: () => NOW },
  });
  return { run: (job: SeoSite) => run(job, new AbortController().signal), jobs, crux, origins, console: consoleFake };
}

describe("the import window", () => {
  it("reaches 16 months back on the first import and 10 days afterwards, with top lists for 90 days", () => {
    expect(importWindow("2026-11-07", true)).toEqual({ from: "2025-07-08", to: "2026-11-06", topFrom: "2026-08-09" });
    expect(importWindow("2026-11-07", false)).toEqual({ from: "2026-10-28", to: "2026-11-06", topFrom: "2026-10-28" });
  });

  it("weights the average position by impressions", () => {
    expect(totalsOf([{ clicks: 1, impressions: 100, position: 2 }, { clicks: 3, impressions: 300, position: 10 }]))
      .toEqual({ clicks: 4, impressions: 400, ctr: 0.01, position: 8 });
    expect(totalsOf([])).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null });
  });

  it("compares a period with the same number of days before it", () => {
    expect(previousPeriod("2026-10-08", "2026-11-06")).toEqual({ from: "2026-09-08", to: "2026-10-07" });
  });
});

describe("Google's thresholds", () => {
  it.each([
    ["LCP", 2500, "GOOD"], ["LCP", 2501, "NEEDS_IMPROVEMENT"], ["LCP", 4600, "POOR"],
    ["INP", 200, "GOOD"], ["INP", 501, "POOR"],
    ["CLS", 0.1, "GOOD"], ["CLS", 0.2, "NEEDS_IMPROVEMENT"], ["CLS", 0.26, "POOR"],
    ["FCP", 1800, "GOOD"], ["TTFB", 1900, "POOR"],
  ] as const)("rate %s at %s as %s", (metric, p75, rating) => {
    expect(rate(metric, p75)).toBe(rating);
  });

  it("pass a device only when LCP, INP and CLS are all good", () => {
    expect(passes([{ metric: "LCP", p75: 2100 }, { metric: "INP", p75: 150 }, { metric: "CLS", p75: 0.05 }])).toBe(true);
    expect(passes([{ metric: "LCP", p75: 4600 }, { metric: "INP", p75: 150 }, { metric: "CLS", p75: 0.05 }])).toBe(false);
    expect(passes([])).toBeNull();
  });

  it("rate a lab score from 90 as good and below 50 as poor", () => {
    expect([rateScore(90), rateScore(89), rateScore(49)]).toEqual(["GOOD", "NEEDS_IMPROVEMENT", "POOR"]);
  });
});

describe("gathering search figures", () => {
  it("asks for the top queries and pages only of days that had impressions", async () => {
    const consoleFake = searchConsole();

    const snapshot = await gatherSearch(consoleFake, site(), "refresh", "2026-11-07");

    expect(consoleFake.totals).toHaveBeenCalledWith("access", "https://shop.ru/", "2025-07-08", "2026-11-06", undefined);
    expect(consoleFake.top).toHaveBeenCalledTimes(2);
    expect(snapshot.queries).toEqual([{ key: "query-2026-11-04", clicks: 1, impressions: 10, position: 2, date: "2026-11-04" }]);
    expect(snapshot.pages).toEqual([{ key: "page-2026-11-04", clicks: 1, impressions: 10, position: 2, date: "2026-11-04" }]);
  });
});

describe("an import run", () => {
  it("stores vitals for the site's origin, then publishes the search figures", async () => {
    const d = fixture();

    await d.run(site());

    expect(d.crux.current).toHaveBeenCalledWith("https://shop.ru", "PHONE", expect.anything());
    expect(d.jobs.saveVitals).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "https://shop.ru", {
      readings: [expect.objectContaining({ device: "PHONE", metric: "LCP" })],
      weeks: [],
    }, NOW);
    expect(d.jobs.complete).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), expect.objectContaining({ to: "2026-11-06" }), NOW);
  });

  it("finds where a domain's home page settles before reading its vitals", async () => {
    const d = fixture();
    await d.run(site({ siteUrl: "sc-domain:site.ru" }));
    expect(d.origins.settle).toHaveBeenCalledWith("https://site.ru/", "sc-domain:site.ru", expect.anything());
    expect(d.jobs.saveVitals).toHaveBeenCalledWith(expect.anything(), "https://www.site.ru", expect.anything(), NOW);
  });

  it("still imports search figures when the Chrome UX Report fails", async () => {
    const d = fixture();
    d.crux.current.mockRejectedValue(new SeoProviderError("PROVIDER"));
    await d.run(site());
    expect(d.jobs.saveVitals).not.toHaveBeenCalled();
    expect(d.jobs.complete).toHaveBeenCalled();
  });

  it("reads no vitals without an API key", async () => {
    const d = fixture({ crux: false });
    await d.run(site());
    expect(d.jobs.saveVitals).not.toHaveBeenCalled();
    expect(d.jobs.complete).toHaveBeenCalled();
  });

  it("keeps reading vitals for a site waiting for a new sign-in, without touching Search Console", async () => {
    const d = fixture();
    await d.run(site({ status: "AUTH_REQUIRED" }));
    expect(d.jobs.saveVitals).toHaveBeenCalled();
    expect(d.console?.accessToken).not.toHaveBeenCalled();
    expect(d.jobs.release).toHaveBeenCalled();
    expect(d.jobs.complete).not.toHaveBeenCalled();
  });

  it("records a revoked sign-in as a token failure and publishes nothing", async () => {
    const d = fixture();
    d.console!.accessToken.mockRejectedValue(new SeoProviderError("TOKEN"));
    await d.run(site());
    expect(d.jobs.complete).not.toHaveBeenCalled();
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "TOKEN", 0, NOW);
  });

  it("publishes nothing when one request fails part-way", async () => {
    const d = fixture();
    d.console!.top.mockRejectedValueOnce(new SeoProviderError("PROVIDER", 30_000));
    await d.run(site());
    expect(d.jobs.complete).not.toHaveBeenCalled();
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), "PROVIDER", 30_000, NOW);
  });

  it("fails as not configured without Google sign-in settings", async () => {
    const d = fixture({ console: null });
    await d.run(site());
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), "CONFIGURATION", 0, NOW);
  });
});
