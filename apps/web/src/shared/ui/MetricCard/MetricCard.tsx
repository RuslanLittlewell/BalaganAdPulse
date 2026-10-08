import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils.js";
import { RollingNumber } from "../RollingNumber/RollingNumber.js";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  chart?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, hint, chart, className }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border border-border glass-card p-4", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {typeof value === "string" || typeof value === "number" ? <RollingNumber value={value} /> : value}
      </div>
      {hint != null && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      {chart != null && <div className="mt-3">{chart}</div>}
    </div>
  );
}
