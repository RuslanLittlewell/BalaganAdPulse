export type Point = readonly [number, number];

export interface ChartPaths {
  readonly line: string;
  readonly area: string;
  readonly points: readonly Point[];
}

export function chartPaths(values: readonly number[], width: number, height: number, pad: number): ChartPaths {
  const count = values.length;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, index): Point => [
    pad + (count < 2 ? 0 : (index / (count - 1)) * (width - pad * 2)),
    height - pad - ((value - low) / span) * (height - pad * 2),
  ]);
  const at = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;
  let line = "";
  points.forEach((point, index) => {
    if (index === 0) {
      line = `M${at(point)}`;
      return;
    }
    const [px, py] = points[index - 1];
    const middle = ((px + point[0]) / 2).toFixed(1);
    line += ` C${middle},${py.toFixed(1)} ${middle},${point[1].toFixed(1)} ${at(point)}`;
  });
  const last = points[count - 1];
  const area = count === 0
    ? ""
    : `${line} L${last[0].toFixed(1)},${height - pad} L${points[0][0].toFixed(1)},${height - pad} Z`;
  return { line, area, points };
}

export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0;
  for (let index = 1; index < xs.length; index++) {
    if (Math.abs(xs[index] - x) < Math.abs(xs[best] - x)) best = index;
  }
  return best;
}

export function leadsWord(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return "лид";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "лида";
  return "лидов";
}
