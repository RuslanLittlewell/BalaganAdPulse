import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { GradientWaves } from "@/shared/ui/index.js";

const GLASS =
  "overflow-hidden rounded-3xl border border-border/60 shadow-2xl backdrop-blur-3xl backdrop-saturate-150 dark:border-white/10";

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
    <div className="relative flex h-screen gap-6 overflow-hidden bg-background p-8 text-foreground">
      <div
        aria-hidden="true"
        data-testid="app-backdrop"
        className="pointer-events-none absolute inset-0"
      >
        <GradientWaves
          mouseInteraction={false}
          horizonColor="#c4a074"
          waveColor="#c4a074"
          crestColor="#c4a074"
          turbulence={17}
          waveScale={0.65}
          parallaxStrength={0}
          zoom={1.1}
        />
      </div>
      <div
        className={`${GLASS} relative z-10 grid min-h-0 shrink-0 grid-rows-[1fr] bg-sidebar/65 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-[200px]"
        }`}
      >
        {sidebar}
      </div>
      <div className={`${GLASS} relative z-10 flex min-w-0 flex-1 flex-col bg-card/65`}>
        <div className="min-w-0">{header}</div>
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
