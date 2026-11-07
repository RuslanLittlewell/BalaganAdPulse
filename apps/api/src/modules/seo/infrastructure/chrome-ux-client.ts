import { z } from "zod";
import type { ChromeUxReport } from "../application/ports.js";
import { SeoProviderError } from "../domain/seo-site.js";
import type { Device, Metric, VitalReading, VitalWeek } from "../domain/vitals.js";
import { askGoogle, refusal } from "./google-request.js";

const BASE = "https://chromeuxreport.googleapis.com/v1/records";
const HISTORY_PERIODS = 40;

const CRUX_METRICS: Record<Metric, string> = {
  LCP: "largest_contentful_paint",
  INP: "interaction_to_next_paint",
  CLS: "cumulative_layout_shift",
  FCP: "first_contentful_paint",
  TTFB: "experimental_time_to_first_byte",
};

const number = z.union([z.number(), z.string()]).transform((value) => Number(value)).pipe(z.number().finite());
const day = z.object({ year: z.number(), month: z.number(), day: z.number() });
const dateOf = (value: z.infer<typeof day>) =>
  `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;

const currentBody = z.object({
  record: z.object({
    metrics: z.record(z.string(), z.object({
      histogram: z.array(z.object({ density: z.number().optional() })).optional(),
      percentiles: z.object({ p75: number }).optional(),
    })),
    collectionPeriod: z.object({ lastDate: day }),
  }),
});

const historyBody = z.object({
  record: z.object({
    metrics: z.record(z.string(), z.object({
      percentilesTimeseries: z.object({ p75s: z.array(z.union([z.number(), z.string(), z.null()])) }).optional(),
    })),
    collectionPeriods: z.array(z.object({ lastDate: day })),
  }),
});

export class ChromeUxClient implements ChromeUxReport {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async current(origin: string, device: Device, signal?: AbortSignal): Promise<VitalReading[]> {
    const body = await this.ask("queryRecord", { origin, formFactor: device, metrics: Object.values(CRUX_METRICS) }, signal);
    if (body === null) return [];
    const parsed = currentBody.safeParse(body);
    if (!parsed.success) throw new SeoProviderError("INVALID_DATA", 0, "crux shape");
    const { metrics, collectionPeriod } = parsed.data.record;
    const periodEnd = dateOf(collectionPeriod.lastDate);
    return (Object.entries(CRUX_METRICS) as [Metric, string][]).flatMap(([metric, key]) => {
      const found = metrics[key];
      if (!found?.percentiles) return [];
      const [good = 0, needsImprovement = 0, poor = 0] = (found.histogram ?? []).map((bin) => bin.density ?? 0);
      return [{ device, metric, periodEnd, p75: found.percentiles.p75, good, needsImprovement, poor }];
    });
  }

  async history(origin: string, device: Device, signal?: AbortSignal): Promise<VitalWeek[]> {
    const body = await this.ask("queryHistoryRecord", {
      origin,
      formFactor: device,
      metrics: Object.values(CRUX_METRICS),
      collectionPeriodCount: HISTORY_PERIODS,
    }, signal);
    if (body === null) return [];
    const parsed = historyBody.safeParse(body);
    if (!parsed.success) throw new SeoProviderError("INVALID_DATA", 0, "crux history shape");
    const { metrics, collectionPeriods } = parsed.data.record;
    const ends = collectionPeriods.map((period) => dateOf(period.lastDate));
    return (Object.entries(CRUX_METRICS) as [Metric, string][]).flatMap(([metric, key]) =>
      (metrics[key]?.percentilesTimeseries?.p75s ?? []).flatMap((value, index) => {
        const p75 = value === null ? Number.NaN : Number(value);
        const periodEnd = ends[index];
        return Number.isFinite(p75) && periodEnd ? [{ device, metric, periodEnd, p75 }] : [];
      }));
  }

  private async ask(method: string, request: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${BASE}:${method}`);
    url.searchParams.set("key", this.apiKey);
    const answer = await askGoogle(this.fetcher, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }, this.timeoutMs, signal);
    if (answer.status === 404) return null;
    if (!answer.ok) throw refusal(answer);
    return answer.body;
  }
}
