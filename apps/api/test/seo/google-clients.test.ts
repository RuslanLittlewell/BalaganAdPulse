import { describe, expect, it, vi } from "vitest";
import { ChromeUxClient } from "../../src/modules/seo/infrastructure/chrome-ux-client.js";
import { PageSpeedClient } from "../../src/modules/seo/infrastructure/page-speed-client.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const date = (day: number) => ({ year: 2026, month: 11, day });

describe("the Chrome UX Report client", () => {
  it("reads each metric's 75th percentile and shares for an origin and device", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ record: {
      key: { origin: "https://shop.ru", formFactor: "PHONE" },
      metrics: {
        largest_contentful_paint: { histogram: [{ start: 0, end: 2500, density: 0.81 }, { start: 2500, end: 4000, density: 0.12 }, { start: 4000, density: 0.07 }], percentiles: { p75: 2210 } },
        cumulative_layout_shift: { histogram: [{ start: "0.00", end: "0.10", density: 0.9 }, { start: "0.10", end: "0.25", density: 0.06 }, { start: "0.25", density: 0.04 }], percentiles: { p75: "0.05" } },
      },
      collectionPeriod: { firstDate: date(1), lastDate: date(5) },
    } }));

    const readings = await new ChromeUxClient("key", fetcher).current("https://shop.ru", "PHONE");

    expect(readings).toEqual([
      { device: "PHONE", metric: "LCP", periodEnd: "2026-11-05", p75: 2210, good: 0.81, needsImprovement: 0.12, poor: 0.07 },
      { device: "PHONE", metric: "CLS", periodEnd: "2026-11-05", p75: 0.05, good: 0.9, needsImprovement: 0.06, poor: 0.04 },
    ]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=key");
    expect(JSON.parse(init.body)).toMatchObject({ origin: "https://shop.ru", formFactor: "PHONE" });
    expect(JSON.parse(init.body).metrics).toContain("experimental_time_to_first_byte");
  });

  it("answers no data for an origin with too few visits", async () => {
    const fetcher = vi.fn().mockImplementation(async () => json({ error: { code: 404, message: "chrome ux report data not found" } }, 404));
    expect(await new ChromeUxClient("key", fetcher).current("https://tiny.ru", "DESKTOP")).toEqual([]);
    expect(await new ChromeUxClient("key", fetcher).history("https://tiny.ru", "DESKTOP")).toEqual([]);
  });

  it("reads the weekly history and skips weeks without a value", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ record: {
      metrics: { interaction_to_next_paint: { percentilesTimeseries: { p75s: [180, null, 210] } } },
      collectionPeriods: [{ firstDate: date(1), lastDate: date(1) }, { firstDate: date(1), lastDate: date(8) }, { firstDate: date(1), lastDate: date(15) }],
    } }));

    const weeks = await new ChromeUxClient("key", fetcher).history("https://shop.ru", "PHONE");

    expect(weeks).toEqual([
      { device: "PHONE", metric: "INP", periodEnd: "2026-11-01", p75: 180 },
      { device: "PHONE", metric: "INP", periodEnd: "2026-11-15", p75: 210 },
    ]);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ collectionPeriodCount: 40 });
  });

  it("treats a refusal as a provider failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({}, 503));
    await expect(new ChromeUxClient("key", fetcher).current("https://shop.ru", "PHONE")).rejects.toMatchObject({ code: "PROVIDER" });
  });
});

describe("the PageSpeed client", () => {
  it("measures a page as a phone and reads the score and lab metrics", async () => {
    const audit = (numericValue: number) => ({ numericValue });
    const fetcher = vi.fn().mockResolvedValue(json({ lighthouseResult: {
      categories: { performance: { score: 0.87 } },
      audits: {
        "largest-contentful-paint": audit(2840.4), "cumulative-layout-shift": audit(0.0412), "total-blocking-time": audit(190),
        "first-contentful-paint": audit(1200.6), "speed-index": audit(3100),
      },
    } }));

    const measured = await new PageSpeedClient("key", fetcher).measure("https://shop.ru/", "PHONE");

    expect(measured).toEqual({ device: "PHONE", score: 87, lcpMs: 2840, cls: 0.0412, tbtMs: 190, fcpMs: 1201, speedIndexMs: 3100 });
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ url: "https://shop.ru/", strategy: "mobile", category: "performance", key: "key" });
  });

  it("refuses an answer without the lab metrics", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ lighthouseResult: {} }));
    await expect(new PageSpeedClient("key", fetcher).measure("https://shop.ru/", "DESKTOP")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });
});
