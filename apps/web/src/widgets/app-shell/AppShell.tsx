import type { ReactNode } from "react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";

export interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  const { collapsed } = useNavCollapse();
  return (
    <div
      className={`grid h-screen grid-rows-[auto_1fr] bg-background text-foreground transition-[grid-template-columns] duration-200 ${
        collapsed ? "grid-cols-[64px_1fr]" : "grid-cols-[200px_1fr]"
      }`}
    >
      <div className={"row-span-2 grid min-h-0 grid-rows-[1fr]"}>{sidebar}</div>
      <div className={"min-w-0"}>{header}</div>
      <main className={"min-w-0 overflow-auto bg-background p-4"}>{children}</main>
    </div>
  );
}
