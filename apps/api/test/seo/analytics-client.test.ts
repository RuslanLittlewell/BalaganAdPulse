import { describe, expect, it, vi } from "vitest";
import { AnalyticsClient } from "../../src/modules/seo/infrastructure/analytics-client.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tokens = { consentUrl: (state: string) => `consent:${state}`, accessToken: async () => "access" };
const client = (fetcher: ReturnType<typeof vi.fn>) => new AnalyticsClient(tokens, fetcher as unknown as typeof fetch);

describe("the Analytics client", () => {
  it("lists properties with their account names, across pages", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({
        accountSummaries: [{ displayName: "Acme", propertySummaries: [{ property: "properties/111", displayName: "site.ru" }] }],
        nextPageToken: "next",
      }))
      .mockResolvedValueOnce(json({ accountSummaries: [{ displayName: "Other", propertySummaries: [{ property: "properties/222" }] }] }));

    const properties = await client(fetcher).properties("access");

    expect(properties).toEqual([{ propertyId: "111", name: "Acme / site.ru" }, { propertyId: "222", name: "Other" }]);
    expect(String(fetcher.mock.calls[1]![0])).toContain("pageToken=next");
    expect(fetcher.mock.calls[0]![1].headers).toMatchObject({ Authorization: "Bearer access" });
  });

  it("answers an account without properties with an empty list", async () => {
    expect(await client(vi.fn().mockResolvedValue(json({}))).properties("access")).toEqual([]);
  });

  it("asks for sessions by date, channel, source and medium and reads the rows", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      rows: [
        { dimensionValues: [{ value: "20261105" }, { value: "Organic Search" }, { value: "google" }, { value: "organic" }], metricValues: [{ value: "120" }] },
        { dimensionValues: [{ value: "20261105" }, { value: "Direct" }, { value: "(direct)" }, { value: "(none)" }], metricValues: [{ value: "30" }] },
      ],
      rowCount: 2,
    }));

    const rows = await client(fetcher).sessions("access", "111", "2026-11-01", "2026-11-05");

    expect(rows).toEqual([
      { date: "2026-11-05", channel: "Organic Search", source: "google", medium: "organic", sessions: 120 },
      { date: "2026-11-05", channel: "Direct", source: "(direct)", medium: "(none)", sessions: 30 },
    ]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://analyticsdata.googleapis.com/v1beta/properties/111:runReport");
    expect(JSON.parse(init.body)).toMatchObject({
      dateRanges: [{ startDate: "2026-11-01", endDate: "2026-11-05" }],
      metrics: [{ name: "sessions" }],
    });
  });

  it("reads the next page while rows remain", async () => {
    const row = (n: number) => ({ dimensionValues: [{ value: "20261105" }, { value: "Direct" }, { value: `s${n}` }, { value: "m" }], metricValues: [{ value: "1" }] });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ rows: Array.from({ length: 10_000 }, (_, n) => row(n)), rowCount: 10_001 }))
      .mockResolvedValueOnce(json({ rows: [row(10_000)], rowCount: 10_001 }));

    const rows = await client(fetcher).sessions("access", "111", "2026-11-01", "2026-11-05");

    expect(rows).toHaveLength(10_001);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).offset).toBe(10_000);
  });

  it("maps refusals to provider errors", async () => {
    await expect(client(vi.fn().mockResolvedValue(json({}, 401))).properties("access")).rejects.toMatchObject({ code: "TOKEN" });
    await expect(client(vi.fn().mockResolvedValue(json({}, 403))).sessions("a", "1", "2026-11-01", "2026-11-02")).rejects.toMatchObject({ code: "ACCESS" });
    await expect(client(vi.fn().mockResolvedValue(json({}, 429))).sessions("a", "1", "2026-11-01", "2026-11-02")).rejects.toMatchObject({ code: "PROVIDER" });
  });

  it("rejects a report row it cannot read", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ rows: [{ dimensionValues: [{ value: "yesterday" }, { value: "a" }, { value: "b" }, { value: "c" }], metricValues: [{ value: "1" }] }] }));
    await expect(client(fetcher).sessions("a", "1", "2026-11-01", "2026-11-02")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });
});
