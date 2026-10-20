import { useEffect, useState } from "react";

export const NOW_TICK_MS = 30_000;

export function useNow(everyMs = NOW_TICK_MS): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(tick);
  }, [everyMs]);
  return now;
}
