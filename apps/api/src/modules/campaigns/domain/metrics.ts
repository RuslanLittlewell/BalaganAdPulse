export interface Measured {
  readonly spend: number;
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenue: number;
}

export const EMPTY_MEASURED: Measured = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
};

export interface MeasuredDay extends Measured {
  readonly date: Date;
}

export function sumByDay(days: readonly MeasuredDay[]): MeasuredDay[] {
  const byDate = new Map<number, MeasuredDay>();
  for (const day of days) {
    const key = day.date.getTime();
    const running = byDate.get(key);
    byDate.set(key, running === undefined
      ? day
      : { ...sumMeasured([running, day]), date: day.date });
  }
  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function sumMeasured(days: readonly Measured[]): Measured {
  return days.reduce<Measured>((total, day) => ({
    spend: total.spend + day.spend,
    impressions: total.impressions + day.impressions,
    reach: total.reach + day.reach,
    clicks: total.clicks + day.clicks,
    conversions: total.conversions + day.conversions,
    revenue: total.revenue + day.revenue,
  }), EMPTY_MEASURED);
}

export interface Derived {
  readonly ctr: number | null;
  readonly cpc: number | null;
  readonly cpm: number | null;
  readonly cpa: number | null;
  readonly roas: number | null;
  readonly frequency: number | null;
}

const ratio = (dividend: number, divisor: number): number | null =>
  divisor === 0 ? null : dividend / divisor;

export function derive(measured: Measured): Derived {
  return {
    ctr: ratio(measured.clicks * 100, measured.impressions),
    cpc: ratio(measured.spend, measured.clicks),
    cpm: ratio(measured.spend * 1000, measured.impressions),
    cpa: ratio(measured.spend, measured.conversions),
    roas: ratio(measured.revenue, measured.spend),
    frequency: ratio(measured.impressions, measured.reach),
  };
}

export interface Performance extends Measured, Derived {}

export function performanceOf(days: readonly Measured[]): Performance {
  const measured = sumMeasured(days);
  return { ...measured, ...derive(measured) };
}
