import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { t } from "@/shared/config/index.js";

const GLASS =
  "overflow-hidden rounded-3xl border border-border/60 shadow-2xl backdrop-blur-3xl backdrop-saturate-150 dark:border-white/10";

export interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  moduleKey: string;
  preview?: boolean;
  children: ReactNode;
}

export function AppShell({
  sidebar,
  header,
  moduleKey,
  preview = false,
  children,
}: AppShellProps) {
  const { collapsed, toggle } = useNavCollapse();
  const reduce = useReducedMotion();
  return (
    <div className="relative flex h-screen gap-6 overflow-hidden bg-background p-8 text-foreground">
      <div
        aria-hidden="true"
        data-testid="app-backdrop"
        className="pointer-events-none absolute inset-0"
      />
      {preview ? null : (
      <div className="relative z-20 flex min-h-0 shrink-0">
        <div
          className={`${GLASS} grid min-h-0 grid-rows-[1fr] bg-sidebar/65 transition-[width] duration-200 ${
            collapsed ? "w-16" : "w-[200px]"
          }`}
        >
          {sidebar}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
          className="absolute top-[52.455%] right-0 grid h-12 w-4 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed
            ? <ChevronRightIcon aria-hidden className="size-3" />
            : <ChevronLeftIcon aria-hidden className="size-3" />}
        </button>
      </div>
      )}
      <div
        className={`${GLASS} relative z-10 flex min-w-0 flex-1 flex-col bg-card/65`}
      >
        {preview ? null : <div className="min-w-0">{header}</div>}
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
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
    </div>
  );
}
