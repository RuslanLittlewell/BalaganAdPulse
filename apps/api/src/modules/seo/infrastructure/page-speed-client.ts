import { z } from "zod";
import type { PageSpeed } from "../application/ports.js";
import { SeoProviderError } from "../domain/seo-site.js";
import type { Device, LabMeasurement } from "../domain/vitals.js";
import { askGoogle, refusal } from "./google-request.js";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const audit = z.object({ numericValue: z.number().nonnegative() });
const body = z.object({
  lighthouseResult: z.object({
    categories: z.object({ performance: z.object({ score: z.number().min(0).max(1) }) }),
    audits: z.object({
      "largest-contentful-paint": audit,
      "cumulative-layout-shift": audit,
      "total-blocking-time": audit,
      "first-contentful-paint": audit,
      "speed-index": audit,
    }),
  }),
});

export class PageSpeedClient implements PageSpeed {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 90_000,
  ) {}

  async measure(address: string, device: Device, signal?: AbortSignal): Promise<LabMeasurement> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("url", address);
    url.searchParams.set("strategy", device === "PHONE" ? "mobile" : "desktop");
    url.searchParams.set("category", "performance");
    url.searchParams.set("key", this.apiKey);
    const answer = await askGoogle(this.fetcher, url, { method: "GET" }, this.timeoutMs, signal);
    if (!answer.ok) throw refusal(answer);
    const parsed = body.safeParse(answer.body);
    if (!parsed.success) throw new SeoProviderError("INVALID_DATA", 0, "pagespeed shape");
    const { categories, audits } = parsed.data.lighthouseResult;
    const ms = (name: keyof typeof audits) => Math.round(audits[name].numericValue);
    return {
      device,
      score: Math.round(categories.performance.score * 100),
      lcpMs: ms("largest-contentful-paint"),
      cls: Math.round(audits["cumulative-layout-shift"].numericValue * 10_000) / 10_000,
      tbtMs: ms("total-blocking-time"),
      fcpMs: ms("first-contentful-paint"),
      speedIndexMs: ms("speed-index"),
    };
  }
}
