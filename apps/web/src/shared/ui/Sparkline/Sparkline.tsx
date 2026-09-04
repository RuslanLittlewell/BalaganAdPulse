import { areaPath, linePath } from "@/shared/lib/index.js";

export interface SparklineProps {
  values: readonly number[];
  label: string;
  width?: number;
  height?: number;
  className?: string;
}

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
