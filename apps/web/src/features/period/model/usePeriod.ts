import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DateRange } from "@/entities/campaign/index.js";
import { defaultRange, isDateRange } from "./period.js";

export function usePeriod() {
  const [params, setParams] = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const setRange = useCallback((next: DateRange) => {
    if (!isDateRange(next)) return;
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      updated.delete("period");
      updated.set("from", next.from);
      updated.set("to", next.to);
      return updated;
    }, { replace: true });
  }, [setParams]);

  const range = useMemo(() => {
    const requested = { from, to };
    return isDateRange(requested) ? requested : defaultRange();
  }, [from, to]);

  return { range, setRange };
}
