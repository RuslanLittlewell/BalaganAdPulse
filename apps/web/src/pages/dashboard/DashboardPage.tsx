import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { useAgencySummary } from "@/entities/campaign/index.js";
import {
  ChannelPanel, PerformanceSummary, ProjectPerformanceTable,
} from "@/widgets/agency-overview/index.js";
import { t } from "@/shared/config/index.js";

export function DashboardPage() {
  const { range } = usePeriod();
  const agency = useAgencySummary(range);

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("nav.dashboard")}</h1>
        <PeriodControl />
      </header>

      <PerformanceSummary performance={agency.data} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <ProjectPerformanceTable range={range} />
        <ChannelPanel range={range} />
      </div>
    </div>
  );
}
