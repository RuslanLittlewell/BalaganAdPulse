const CENTER = 50;
const OUTER = 45;
const INNER = 29;
const FULL = 99.99;

export const KPI_PARTS = ["met", "behind", "danger", "unrated"] as const;

export type KpiPart = (typeof KPI_PARTS)[number];

export type KpiCounts = Record<KpiPart, number>;

function point(radius: number, percent: number): string {
  const angle = (percent / 100) * 2 * Math.PI;
  return `${(CENTER + radius * Math.sin(angle)).toFixed(3)} ${(CENTER - radius * Math.cos(angle)).toFixed(3)}`;
}

function circle(radius: number, sweep: 0 | 1): string {
  const top = `${CENTER} ${CENTER - radius}`;
  return `M ${top} A ${radius} ${radius} 0 1 ${sweep} ${CENTER} ${CENTER + radius} A ${radius} ${radius} 0 1 ${sweep} ${top} Z`;
}

export function sector(start: number, length: number): string {
  if (length <= 0) return "";
  if (length >= FULL) return `${circle(OUTER, 1)} ${circle(INNER, 0)}`;
  const end = start + length;
  const large = length > 50 ? 1 : 0;
  return `M ${point(OUTER, start)} A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)} L ${point(INNER, end)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)} Z`;
}

export function segments(counts: KpiCounts, total: number): Record<KpiPart, string> {
  let start = 0;
  const paths = {} as Record<KpiPart, string>;
  for (const part of KPI_PARTS) {
    const length = total === 0 ? 0 : (counts[part] / total) * 100;
    paths[part] = sector(start, length);
    start += length;
  }
  return paths;
}

export const RING = sector(0, 100);
