import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_PERIOD, isPeriod, rangeOf, type Period } from "./period.js";

/**
 * The period every screen reads, kept in the address.
 *
 * In the URL rather than in a context because a range is part of what a link
 * means: a colleague sent "last month's figures for this project" should open
 * last month's figures. An unknown or absent value falls back to the default
 * rather than erroring — an address is user input.
 */
export function usePeriod() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("period");
  const period: Period = isPeriod(raw) ? raw : DEFAULT_PERIOD;

  const setPeriod = useCallback((next: Period) => {
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      updated.set("period", next);
      return updated;
    }, { replace: true });
  }, [setParams]);

  // The range is recomputed only when the period changes, so a re-render does
  // not hand every query a new object and refetch the screen.
  const range = useMemo(() => rangeOf(period), [period]);

  return { period, setPeriod, range };
}
