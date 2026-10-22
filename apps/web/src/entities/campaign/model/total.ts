import type { Measured, Performance } from "../api/api.js";

const NOTHING_MEASURED: Measured = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0,
};

const ratio = (dividend: number, divisor: number): number | null =>
  divisor === 0 ? null : dividend / divisor;

export function totalPerformance(performances: readonly Measured[]): Performance {
  const measured = performances.reduce<Measured>((total, performance) => ({
    spend: total.spend + performance.spend,
    impressions: total.impressions + performance.impressions,
    reach: total.reach + performance.reach,
    clicks: total.clicks + performance.clicks,
    conversions: total.conversions + performance.conversions,
    results: total.results + performance.results,
    revenue: total.revenue + performance.revenue,
  }), NOTHING_MEASURED);
  return {
    ...measured,
    ctr: ratio(measured.clicks * 100, measured.impressions),
    cpc: ratio(measured.spend, measured.clicks),
    cpm: ratio(measured.spend * 1000, measured.impressions),
    cpa: ratio(measured.spend, measured.conversions),
    costPerResult: ratio(measured.spend, measured.results),
    roas: ratio(measured.revenue, measured.spend),
    frequency: ratio(measured.impressions, measured.reach),
  };
}
