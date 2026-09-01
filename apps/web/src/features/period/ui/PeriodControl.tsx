import { Button } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { PERIODS, periodLabel } from "../model/period.js";
import { usePeriod } from "../model/usePeriod.js";

/** One control, wherever figures are shown. It writes to the address, so every
 * screen reading `usePeriod` follows it without being wired to it. */
export function PeriodControl() {
  const { period, setPeriod } = usePeriod();

  return (
    <div role="group" aria-label={t("period.label")} className="flex flex-wrap gap-1">
      {PERIODS.map((candidate) => (
        <Button
          key={candidate}
          size="sm"
          variant={candidate === period ? "secondary" : "ghost"}
          aria-pressed={candidate === period}
          onClick={() => setPeriod(candidate)}
        >
          {periodLabel(candidate)}
        </Button>
      ))}
    </div>
  );
}
