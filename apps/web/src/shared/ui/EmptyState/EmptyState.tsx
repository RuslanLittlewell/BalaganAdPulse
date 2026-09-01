import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={"grid place-items-center py-12 text-center"}>
      {icon != null && <div className={"mx-auto text-muted-foreground"}>{icon}</div>}
      <h2 className={"text-xl font-bold"}>{title}</h2>
      {description != null && <p className={"mt-2 text-sm text-muted-foreground"}>{description}</p>}
      {action != null && <div className={"flex items-center justify-end gap-2"}>{action}</div>}
    </div>
  );
}
