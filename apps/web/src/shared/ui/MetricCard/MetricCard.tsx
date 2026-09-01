import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils.js";

export interface MetricCardProps {
  label: string;
  value: string;
  /** A second figure that explains the first — the ratio derived from it. */
  hint?: string;
  chart?: ReactNode;
  className?: string;
}

/** One figure, named. The KPI row on every screen is a row of these. */
export function MetricCard({ label, value, hint, chart, className }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint != null && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      {chart != null && <div className="mt-3">{chart}</div>}
    </div>
  );
}
