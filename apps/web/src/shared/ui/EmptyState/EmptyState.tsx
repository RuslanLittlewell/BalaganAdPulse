import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils.js";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cn("grid place-items-center text-center", compact ? "py-6" : "py-12")}>
      {icon != null && <div className={"mx-auto text-muted-foreground"}>{icon}</div>}
      <h2 className={compact ? "whitespace-nowrap text-sm font-semibold text-muted-foreground" : "text-xl font-bold"}>{title}</h2>
      {description != null && <p className={"mt-2 text-sm text-muted-foreground"}>{description}</p>}
      {action != null && <div className={"flex items-center justify-end gap-2"}>{action}</div>}
    </div>
  );
}
