import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";

export interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  moduleKey: string;
  children: ReactNode;
}

export function AppShell({ sidebar, header, moduleKey, children }: AppShellProps) {
  const { collapsed } = useNavCollapse();
  const reduce = useReducedMotion();
  return (
    <div
      className={`grid h-screen grid-rows-[auto_1fr] bg-background text-foreground transition-[grid-template-columns] duration-200 ${
        collapsed ? "grid-cols-[64px_1fr]" : "grid-cols-[200px_1fr]"
      }`}
    >
      <div className={"row-span-2 grid min-h-0 grid-rows-[1fr]"}>{sidebar}</div>
      <div className={"min-w-0"}>{header}</div>
      <main className={"min-w-0 overflow-auto bg-background p-4"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={moduleKey}
            className="h-full"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduce ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
