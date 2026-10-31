import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { useAgencySummary } from "@/entities/campaign/index.js";
import { useChooseSummaryTiles, useSummaryTiles } from "@/entities/summary-tiles/index.js";
import {
  ChannelPanel, KpiOverview, PerformanceSummary, ProjectPerformanceTable,
} from "@/widgets/agency-overview/index.js";
import { t } from "@/shared/config/index.js";
import { useAlerts } from "@/shared/ui/index.js";
import { useCan } from "@/features/permissions/index.js";

const DASHBOARD = { kind: "dashboard" } as const;

export function DashboardPage() {
  const { range } = usePeriod();
  const agency = useAgencySummary(range);
  const managesAgencyKpi = useCan("update", "organization");
  const tiles = useSummaryTiles(DASHBOARD);
  const chooseTiles = useChooseSummaryTiles(DASHBOARD);
  const { raise } = useAlerts();

  return (
    <div className="flex min-h-0 flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("nav.dashboard")}</h1>
        <PeriodControl />
      </header>

      <PerformanceSummary
        tiles={tiles.data?.tiles ?? []}
        onTilesChange={tiles.data
          ? (next) => chooseTiles.mutate({ tiles: next }, { onError: () => raise(t("summary.notSaved")) })
          : undefined}
        range={range}
        currencyPerformances={agency.data}
        currency={null}
        kpi={managesAgencyKpi ? { scope: { kind: "organization" }, canEdit: true } : undefined}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <KpiOverview />
        <ChannelPanel range={range} />
      </div>

      <ProjectPerformanceTable range={range} />
    </div>
  );
}
