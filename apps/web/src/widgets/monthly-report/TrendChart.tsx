import { monthShort } from "@/entities/report/index.js";

export interface TrendPoint {
  month: string;
  value: number | null;
  label: string;
}

const HEIGHT = 100;

export function TrendChart({ title, points }: { title: string; points: TrendPoint[] }) {
  const highest = Math.max(0, ...points.map((point) => point.value ?? 0)) || 1;
  const x = (index: number) => (points.length === 1 ? 50 : 6 + (index / (points.length - 1)) * 88);
  const y = (value: number) => 88 - (value / highest) * 64;
  const drawn = points.flatMap((point, index) => (point.value === null ? [] : [{ x: x(index), y: y(point.value) }]));

  return (
    <figure className="rounded-lg border border-border p-4">
      <figcaption className="text-sm font-semibold text-foreground">{title}</figcaption>
      <div className="relative mt-3 h-40">
        <svg aria-hidden viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
          <polyline
            points={drawn.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="stroke-primary"
          />
        </svg>
        <ol aria-label={title} className="absolute inset-0">
          {points.map((point, index) => (
            <li
              key={point.month}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${x(index)}%`, top: `${point.value === null ? 88 : y(point.value)}%` }}
            >
              <span className="-translate-y-6 whitespace-nowrap text-xs font-medium tabular-nums text-foreground">
                {point.label}
              </span>
              <span aria-hidden className="-mt-4 size-2.5 -translate-y-1/2 rounded-full bg-primary" />
              <span className="sr-only">{monthShort(point.month)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-xs text-muted-foreground">
        {points.map((point, index) => (
          <span key={point.month} className="absolute -translate-x-1/2" style={{ left: `${x(index)}%` }}>
            {monthShort(point.month)}
          </span>
        ))}
      </div>
    </figure>
  );
}
