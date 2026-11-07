export const DEVICES = ["PHONE", "DESKTOP"] as const;
export type Device = (typeof DEVICES)[number];

export const METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type Metric = (typeof METRICS)[number];

export type Rating = "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";

export const THRESHOLDS: Record<Metric, readonly [good: number, poor: number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export interface VitalReading {
  readonly device: Device;
  readonly metric: Metric;
  readonly periodEnd: string;
  readonly p75: number;
  readonly good: number;
  readonly needsImprovement: number;
  readonly poor: number;
}

export interface VitalWeek {
  readonly device: Device;
  readonly metric: Metric;
  readonly periodEnd: string;
  readonly p75: number;
}

export interface VitalsSnapshot {
  readonly readings: readonly VitalReading[];
  readonly weeks: readonly VitalWeek[];
}

export interface LabMeasurement {
  readonly device: Device;
  readonly score: number;
  readonly lcpMs: number;
  readonly cls: number;
  readonly tbtMs: number;
  readonly fcpMs: number;
  readonly speedIndexMs: number;
}

export function rate(metric: Metric, p75: number): Rating {
  const [good, poor] = THRESHOLDS[metric];
  if (p75 <= good) return "GOOD";
  return p75 <= poor ? "NEEDS_IMPROVEMENT" : "POOR";
}

export function rateScore(score: number): Rating {
  if (score >= 90) return "GOOD";
  return score >= 50 ? "NEEDS_IMPROVEMENT" : "POOR";
}

export function passes(readings: readonly Pick<VitalReading, "metric" | "p75">[]): boolean | null {
  const byMetric = new Map(readings.map((reading) => [reading.metric, reading.p75]));
  const core = (["LCP", "INP", "CLS"] as const).filter((metric) => byMetric.has(metric));
  if (!byMetric.has("LCP") || !byMetric.has("CLS")) return null;
  return core.every((metric) => rate(metric, byMetric.get(metric)!) === "GOOD");
}
