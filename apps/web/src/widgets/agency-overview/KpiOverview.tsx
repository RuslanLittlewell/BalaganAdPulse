import { shortcutRange } from "@/features/period/index.js";
import { DueTasks } from "./DueTasks.js";
import { ImportantInfo } from "./ImportantInfo.js";
import { KpiDoughnut } from "./KpiDoughnut.js";
import { useMonthlyKpiStandings } from "./monthlyKpiStandings.js";

export function KpiOverview() {
  const range = shortcutRange("month");
  const standings = useMonthlyKpiStandings(range);

  return (
    <>
      <KpiDoughnut range={range} counts={standings} />
      <ImportantInfo projectsWithoutKpi={standings?.withoutKpi} />
      <DueTasks />
    </>
  );
}
