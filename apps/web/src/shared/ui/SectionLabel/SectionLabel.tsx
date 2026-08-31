import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className={"px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"}>{children}</div>;
}
