import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className={"px-3 py-2 text-xs font-semibold text-muted-foreground"}>{children}</div>;
}
