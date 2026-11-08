import { describe, expect, it, vi } from "vitest";
import { createPageCheck } from "../../src/modules/seo/application/page-check.js";
import type { CheckResult, FetchOutcome } from "../../src/modules/seo/application/ports.js";
import { SeoProviderError, type SeoSite } from "../../src/modules/seo/domain/seo-site.js";
import { HtmlPageParser, XmlSitemapParser } from "../../src/modules/seo/infrastructure/page-reader.js";

const NOW = new Date("2026-11-07T06:00:00Z");

const site = (over: Partial<SeoSite> = {}): SeoSite => ({
  id: "s1", projectId: "p1", siteUrl: "https://shop.ru/", origin: null, encryptedToken: "enc(refresh)", revision: "v1",
  status: "SUCCESS", lastSuccessAt: NOW, lastError: null, nextDailyAt: NOW, queuedAt: null, retryCount: 0,
  leaseOwner: null, leaseUntil: null, vitalsReadAt: null, checkStatus: "RUNNING", lastCheckAt: null, checkError: null,
  nextCheckAt: NOW, checkQueuedAt: null, checkLeaseOwner: "me", checkLeaseUntil: NOW,
  analyticsPropertyId: null, analyticsName: null, trafficStatus: "QUEUED", trafficSuccessAt: null, trafficError: null,
  nextTrafficAt: null, trafficQueuedAt: null, trafficRetryCount: 0, trafficLeaseOwner: null, trafficLeaseUntil: null,
  createdAt: NOW,
  ...over,
});

const html = (body: string, status = 200): FetchOutcome => ({
  kind: "response", status, finalUrl: "", contentType: "text/html", headers: {}, body: Buffer.from(body), ms: 50,
});

function fixture(responses: Record<string, FetchOutcome>, options: { pageSpeed?: boolean; budgetMs?: number; impressions?: string[] } = {}) {
  let clock = NOW.getTime();
  const fetched: string[] = [];
  const fetcher = {
    fetch: vi.fn(async (address: string) => {
      fetched.push(address);
      clock += 100;
      const found = responses[address];
      if (!found) return { kind: "response" as const, status: 404, finalUrl: address, contentType: "text/html", headers: {}, body: Buffer.from(""), ms: 10 };
      return found.kind === "response" && !found.finalUrl ? { ...found, finalUrl: address } : found;
    }),
  };
  const jobs = {
    claim: vi.fn(), renew: vi.fn(),
    impressionPages: vi.fn(async () => options.impressions ?? []),
    complete: vi.fn(async (_job: SeoSite, _result: CheckResult) => true),
    fail: vi.fn(async () => {}),
  };
  const pause = vi.fn(async (ms: number) => { clock += ms; });
  const pageSpeed = {
    measure: vi.fn(async (_url: string, device: "PHONE" | "DESKTOP") => ({ device, score: 90, lcpMs: 2000, cls: 0.01, tbtMs: 100, fcpMs: 900, speedIndexMs: 1500 })),
  };
  const searchConsole = {
    consentUrl: vi.fn(), sites: vi.fn(), totals: vi.fn(), top: vi.fn(),
    accessToken: vi.fn(async () => "access"),
    sitemaps: vi.fn(async () => ["https://shop.ru/submitted.xml"]),
  };
  const run = createPageCheck({
    jobs,
    fetcher,
    pages: new HtmlPageParser(),
    sitemaps: new XmlSitemapParser(),
    console: searchConsole,
    cipher: { encrypt: (token) => token, decrypt: (value) => value },
    pageSpeed: options.pageSpeed === false ? null : pageSpeed,
    clock: { now: () => new Date(clock) },
    pause,
    budgetMs: options.budgetMs ?? 45 * 60_000,
  });
  const result = () => jobs.complete.mock.calls[0]![1];
  return { run: (job = site()) => run(job, new AbortController().signal), jobs, fetched, pause, pageSpeed, searchConsole, result };
}

const tidy = (title: string) => html(`<title>${title}</title><meta name="description" content="${title} описание"><h1>${title}</h1>`);
const sitemap = (...pages: string[]) => html(`<urlset>${pages.map((page) => `<url><loc>${page}</loc></url>`).join("")}</urlset>`);

describe("a page check", () => {
  it("checks the home page, the sitemap pages and the pages with impressions, and marks their problems", async () => {
    const d = fixture({
      "https://shop.ru/": tidy("Главная"),
      "https://shop.ru/robots.txt": html("User-agent: *\nDisallow: /private/\nSitemap: https://shop.ru/main.xml"),
      "https://shop.ru/main.xml": sitemap("https://shop.ru/okna", "https://shop.ru/private/report", "https://other.ru/x"),
      "https://shop.ru/okna": html("<title>Окна</title>"),
      "https://shop.ru/searched": tidy("Найдено"),
    }, { impressions: ["https://shop.ru/searched"] });

    await d.run();

    const { pages, problems, notChecked } = d.result();
    expect(pages.map((page) => page.url)).toEqual([
      "https://shop.ru/", "https://shop.ru/searched", "https://shop.ru/okna", "https://shop.ru/private/report",
    ]);
    expect(problems.get("https://shop.ru/okna")).toEqual(["DESCRIPTION_MISSING", "H1_MISSING"]);
    expect(pages.find((page) => page.url === "https://shop.ru/private/report")).toMatchObject({ outcome: "BLOCKED" });
    expect(problems.get("https://shop.ru/private/report")).toEqual(["ROBOTS_BLOCKED"]);
    expect(d.fetched).not.toContain("https://shop.ru/private/report");
    expect(d.fetched).not.toContain("https://other.ru/x");
    expect(d.fetched).toContain("https://shop.ru/submitted.xml");
    expect(notChecked).toBe(0);
  });

  it("fetches one page a second", async () => {
    const d = fixture({ "https://shop.ru/": tidy("Главная"), "https://shop.ru/robots.txt": html("", 404) });
    await d.run();
    expect(d.pause).toHaveBeenCalled();
    expect(d.pause.mock.calls.every(([ms]) => ms <= 1000)).toBe(true);
  });

  it("takes a lab measurement of the home page as a phone and a desktop", async () => {
    const d = fixture({ "https://shop.ru/": tidy("Главная"), "https://shop.ru/robots.txt": html("", 404) });
    await d.run();
    expect(d.pageSpeed.measure.mock.calls.map(([url, device]) => [url, device])).toEqual([["https://shop.ru/", "PHONE"], ["https://shop.ru/", "DESKTOP"]]);
    expect(d.result().labs).toHaveLength(2);
  });

  it("completes when PageSpeed fails", async () => {
    const d = fixture({ "https://shop.ru/": tidy("Главная"), "https://shop.ru/robots.txt": html("", 404) });
    d.pageSpeed.measure.mockRejectedValue(new SeoProviderError("PROVIDER"));
    await d.run();
    expect(d.jobs.complete).toHaveBeenCalled();
    expect(d.result().labs).toEqual([]);
  });

  it("does not ask Search Console for sitemaps while the sign-in is revoked", async () => {
    const d = fixture({ "https://shop.ru/": tidy("Главная"), "https://shop.ru/robots.txt": html("", 404) });
    await d.run(site({ status: "AUTH_REQUIRED" }));
    expect(d.searchConsole.sitemaps).not.toHaveBeenCalled();
    expect(d.jobs.complete).toHaveBeenCalled();
  });

  it("counts the pages it had no time left for as not checked", async () => {
    const d = fixture({
      "https://shop.ru/": tidy("Главная"),
      "https://shop.ru/robots.txt": html("", 404),
      "https://shop.ru/sitemap.xml": sitemap("https://shop.ru/a", "https://shop.ru/b", "https://shop.ru/c"),
    }, { budgetMs: 2500 });

    await d.run();

    expect(d.result().pages.length + d.result().notChecked).toBe(4);
    expect(d.result().notChecked).toBeGreaterThan(0);
  });

  it("fails when neither robots.txt nor the home page answer, publishing nothing", async () => {
    const down: FetchOutcome = { kind: "unreachable", reason: "NETWORK", ms: 10 };
    const d = fixture({ "https://shop.ru/": down, "https://shop.ru/robots.txt": down });
    await d.run();
    expect(d.jobs.complete).not.toHaveBeenCalled();
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "UNREACHABLE", expect.any(Date));
  });

  it("fails when robots.txt answers with a server error, since its rules are unknown", async () => {
    const d = fixture({ "https://shop.ru/": tidy("Главная"), "https://shop.ru/robots.txt": html("", 503) });
    await d.run();
    expect(d.jobs.fail).toHaveBeenCalledWith(expect.anything(), "ROBOTS", expect.anything());
  });

  it("records a home page that redirects off the site", async () => {
    const d = fixture({
      "https://shop.ru/": { kind: "off-site", status: 301, location: "https://elsewhere.ru/", ms: 10 },
      "https://shop.ru/robots.txt": html("", 404),
    });
    await d.run();
    expect(d.result().pages[0]).toMatchObject({ outcome: "OFF_SITE_REDIRECT", finalUrl: "https://elsewhere.ru/" });
  });
});
