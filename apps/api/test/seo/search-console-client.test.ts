import { describe, expect, it, vi } from "vitest";
import { SearchConsoleClient } from "../../src/modules/seo/infrastructure/search-console-client.js";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const tokens = { consentUrl: (state: string) => `consent:${state}`, accessToken: async () => "access" };
const client = (fetcher: ReturnType<typeof vi.fn>) => new SearchConsoleClient(tokens, fetcher as unknown as typeof fetch);

describe("the Search Console client", () => {
  it("lists verified sites only, with the access token", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ siteEntry: [
      { siteUrl: "sc-domain:site.ru", permissionLevel: "siteOwner" },
      { siteUrl: "https://shop.ru/", permissionLevel: "siteUnverifiedUser" },
      { siteUrl: "https://blog.ru/", permissionLevel: "siteRestrictedUser" },
    ] }));

    const sites = await client(fetcher).sites("access");

    expect(sites.map((entry) => entry.siteUrl)).toEqual(["sc-domain:site.ru", "https://blog.ru/"]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://searchconsole.googleapis.com/webmasters/v3/sites");
    expect(init.headers).toMatchObject({ Authorization: "Bearer access" });
  });

  it("answers an account without sites with an empty list", async () => {
    expect(await client(vi.fn().mockResolvedValue(json({}))).sites("access")).toEqual([]);
  });

  it("asks for final web figures by date for the encoded property", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ rows: [
      { keys: ["2026-11-01"], clicks: 12, impressions: 400, ctr: 0.03, position: 8.25 },
    ] }));

    const days = await client(fetcher).totals("access", "sc-domain:site.ru", "2026-10-01", "2026-11-01");

    expect(days).toEqual([{ date: "2026-11-01", clicks: 12, impressions: 400, position: 8.25 }]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Asite.ru/searchAnalytics/query");
    expect(JSON.parse(init.body)).toEqual({
      startDate: "2026-10-01", endDate: "2026-11-01", dimensions: ["date"], rowLimit: 25000, type: "web", dataState: "final",
    });
  });

  it("asks for one day's top 1,000 queries or pages", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ rows: [{ keys: ["купить окна"], clicks: 3, impressions: 90, ctr: 0.03, position: 4 }] }));

    const rows = await client(fetcher).top("access", "https://shop.ru/", "2026-11-01", "query");

    expect(rows).toEqual([{ key: "купить окна", clicks: 3, impressions: 90, position: 4 }]);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["query"], rowLimit: 1000 });
  });

  it("lists the sitemaps submitted for the site", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ sitemap: [{ path: "https://site.ru/sitemap.xml" }] }));
    expect(await client(fetcher).sitemaps("access", "sc-domain:site.ru")).toEqual(["https://site.ru/sitemap.xml"]);
  });

  it.each([
    [401, "TOKEN"],
    [403, "ACCESS"],
    [429, "PROVIDER"],
    [503, "PROVIDER"],
    [400, "INVALID_DATA"],
  ])("classifies a %s answer as %s", async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: {} }, status));
    await expect(client(fetcher).sites("access")).rejects.toMatchObject({ code });
  });

  it("treats a malformed answer as invalid data", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ rows: [{ keys: [], clicks: "many" }] }));
    await expect(client(fetcher).totals("access", "sc-domain:site.ru", "2026-10-01", "2026-11-01")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });

  it("treats a network failure as a provider failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(client(fetcher).sites("access")).rejects.toMatchObject({ code: "PROVIDER" });
  });
});
