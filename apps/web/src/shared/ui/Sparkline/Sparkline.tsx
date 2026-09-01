import { areaPath, linePath } from "@/shared/lib/index.js";

export interface SparklineProps {
  values: readonly number[];
  /** Named for a screen reader: a shape with no label says nothing to someone
   * who cannot see it. */
  label: string;
  width?: number;
  height?: number;
  className?: string;
}

/** The shape of a series, small enough to sit inside a table cell. Nothing
 * measured draws nothing — a flat line at zero would read as a real result. */
export function Sparkline({ values, label, width = 96, height = 28, className }: SparklineProps) {
  if (values.length === 0) return null;
  const box = { width, height };

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={className}
    >
      <path d={areaPath(values, box)} className="fill-primary/10" />
      <path
        d={linePath(values, box)}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="stroke-primary"
      />
    </svg>
  );
}
