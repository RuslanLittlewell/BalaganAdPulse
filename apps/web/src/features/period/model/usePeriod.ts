import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_PERIOD, isPeriod, rangeOf, type Period } from "./period.js";

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

  const range = useMemo(() => rangeOf(period), [period]);

  return { period, setPeriod, range };
}
