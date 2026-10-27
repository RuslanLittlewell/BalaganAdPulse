import { useLocation, useNavigate } from "react-router-dom";
import { Sparkline } from "@/shared/ui/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useProjects, type Project } from "@/entities/project/index.js";
import { EMPTY_PERFORMANCE, useProjectsSummary, type DateRange } from "@/entities/campaign/index.js";
import { LEAD_STAGES, useProjectStageCounts } from "@/entities/lead/index.js";
import { useModuleEnabled } from "@/features/auth/index.js";
import { kpiTrend } from "./kpiTrend.js";
import { projectKpiPercent, toneOfPercent, type ProjectTone } from "@/widgets/project-list/projectTone.js";
import { PerformanceTable, type ExtraColumn, type PerformanceRow } from "@/widgets/performance-table/index.js";

const KPI_COLUMN: ExtraColumn = {
  id: "kpi",
  label: t("dashboard.kpiColumn"),
  format: (value) => `${value}%`,
  shown: true,
};

const ROW_TONE: Record<ProjectTone, NonNullable<PerformanceRow["tone"]>> = {
  none: "idle",
  danger: "danger",
  behind: "stable",
  met: "profitable",
};

const STAGE_COLUMNS: readonly ExtraColumn[] = LEAD_STAGES.map((stage) => ({
  id: `crm-${stage}`,
  label: `${t("dashboard.crmColumn")} (${t(`crm.stage.${stage}`)})`,
}));

function useProjectFigures(projects: Project[], range: DateRange) {
  const summary = useProjectsSummary(range);
  const byProject = new Map((summary.data ?? []).map((figures) => [figures.projectId, figures]));
  return projects.map((project) => ({
    project,
    performance: byProject.get(project.id)?.performance ?? EMPTY_PERFORMANCE,
    entry: byProject.get(project.id),
  }));
}

export function ProjectPerformanceTable({ range }: { range: DateRange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const projects = useProjects();
  const figures = useProjectFigures(projects.data ?? [], range);
  const crm = useModuleEnabled("CRM");
  const stageCounts = useProjectStageCounts(range, { enabled: crm });
  const countsByProject = new Map((stageCounts.data ?? []).map((counts) => [counts.projectId, counts]));

  const rows: PerformanceRow[] = figures.map(({ project, performance, entry }) => {
    const percent = projectKpiPercent(entry, range);
    const trend = kpiTrend(entry, range);
    const stageCounts = crm
      ? Object.fromEntries(
        LEAD_STAGES.map((stage) => [`crm-${stage}`, countsByProject.get(project.id)?.[stage] ?? 0]),
      )
      : {};
    return {
      id: project.id,
      name: project.name,
      badge: trend.length === 0 ? undefined : (
        <Sparkline
          values={trend}
          label={`${t("dashboard.kpiTrend")}: ${project.name}`}
          className="ml-auto"
        />
      ),
      tone: ROW_TONE[toneOfPercent(percent)],
      performance,
      currency: project.budgetCurrency,
      extra: { kpi: percent, ...stageCounts },
    };
  });

  return (
    <PerformanceTable
      tableKey="projects"
      heading={t("dashboard.project")}
      rows={rows}
      extraColumns={crm ? [KPI_COLUMN, ...STAGE_COLUMNS] : [KPI_COLUMN]}
      empty={projects.isSuccess ? t("projects.empty.title") : undefined}
      onOpen={(id) => navigate(`${projectPath(id)}${location.search}`)}
    />
  );
}
