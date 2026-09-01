/**
 * What the ad platform measured, for one entity on one day.
 *
 * Six figures and no ratios: everything else a media buyer reads is derived
 * from these. Stored as numbers rather than decimals because they are counts
 * and money in whole units of the account's currency; the adapter converts.
 */
export interface Measured {
  readonly spend: number;
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenue: number;
}

/** A range that contained nothing. Zero of everything is the honest answer —
 * the entity spent nothing — rather than an absence every caller must handle. */
export const EMPTY_MEASURED: Measured = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
};

/** A measured day that still knows which day it was. The sums drop the date
 * deliberately — a range has no single date — but a chart cannot label an axis
 * without one. */
export interface MeasuredDay extends Measured {
  readonly date: Date;
}

/**
 * Several sources' days folded into one series, one entry per calendar date.
 *
 * A project's shape over time is its campaigns' days added up per date. A date
 * nothing measured is left out rather than filled with a zero: the difference
 * between "spent nothing" and "not reported yet" belongs to the caller, and a
 * chart that wants a continuous axis can fill the gaps itself.
 */
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

/**
 * The ratios, each `null` where it was not measurable.
 *
 * Null rather than zero: a campaign that spent money and got no clicks has no
 * cost per click, and `0` would read as free — the opposite of what happened.
 */
export interface Derived {
  /** Clicks per hundred impressions. */
  readonly ctr: number | null;
  readonly cpc: number | null;
  /** Spend per thousand impressions. */
  readonly cpm: number | null;
  readonly cpa: number | null;
  readonly roas: number | null;
  /** Impressions per person reached. */
  readonly frequency: number | null;
}

/** Divides, or answers null when nothing was measured to divide by. */
const ratio = (dividend: number, divisor: number): number | null =>
  divisor === 0 ? null : dividend / divisor;

/**
 * Derived at the moment of reading, never stored.
 *
 * A stored ratio is a second source of truth for something already recorded,
 * and the two drift the moment a figure is corrected. It also cannot be
 * re-summed: a week's CTR is the week's clicks over the week's impressions,
 * not the average of seven daily CTRs. Deriving from the summed figures makes
 * the right answer the only one available.
 */
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

/** What a screen reads: the totals and the ratios that go beside them. */
export interface Performance extends Measured, Derived {}

export function performanceOf(days: readonly Measured[]): Performance {
  const measured = sumMeasured(days);
  return { ...measured, ...derive(measured) };
}
