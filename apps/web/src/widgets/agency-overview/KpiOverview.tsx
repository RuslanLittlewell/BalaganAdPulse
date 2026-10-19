import { shortcutRange } from "@/features/period/index.js";
import { ImportantInfo } from "./ImportantInfo.js";
import { KpiGauge } from "./KpiGauge.js";
import { useMonthlyKpiStandings } from "./monthlyKpiStandings.js";

export function KpiOverview() {
  const range = shortcutRange("month");
  const standings = useMonthlyKpiStandings(range);

  return (
    <>
      <KpiGauge range={range} counts={standings} />
      <ImportantInfo projectsWithoutKpi={standings?.withoutKpi} />
    </>
  );
}
