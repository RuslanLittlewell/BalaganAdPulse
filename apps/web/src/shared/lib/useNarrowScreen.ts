import { useCallback, useSyncExternalStore } from "react";

const BREAKPOINTS = { md: "48rem", lg: "64rem" } as const;

export type ScreenBreakpoint = keyof typeof BREAKPOINTS;

const narrowerThan = (breakpoint: ScreenBreakpoint) =>
  typeof window === "undefined" || !window.matchMedia
    ? null
    : window.matchMedia(`not all and (min-width: ${BREAKPOINTS[breakpoint]})`);

export function useNarrowScreen(breakpoint: ScreenBreakpoint = "md"): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const query = narrowerThan(breakpoint);
      query?.addEventListener("change", onChange);
      return () => query?.removeEventListener("change", onChange);
    },
    [breakpoint],
  );
  return useSyncExternalStore(subscribe, () => narrowerThan(breakpoint)?.matches ?? false, () => false);
}
