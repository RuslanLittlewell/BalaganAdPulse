import { useLocation, useNavigate } from "react-router-dom";
import { Sparkline } from "@/shared/ui/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useProjects, type Project } from "@/entities/project/index.js";
import { EMPTY_PERFORMANCE, useProjectsSummary, type DateRange } from "@/entities/campaign/index.js";
import { LEAD_STAGES, useProjectStageCounts } from "@/entities/lead/index.js";
import { useModuleEnabled } from "@/features/auth/index.js";
import { PerformanceTable, type ExtraColumn, type PerformanceRow } from "@/widgets/performance-table/index.js";

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
    days: byProject.get(project.id)?.days ?? [],
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

  const rows: PerformanceRow[] = figures.map(({ project, performance, days }) => ({
    id: project.id,
    name: project.name,
    badge: days.length === 0 ? undefined : (
      <Sparkline
        values={days.map((day) => day.spend)}
        label={`${t("dashboard.spendByDay")}: ${project.name}`}
        className="ml-auto"
      />
    ),
    performance,
    currency: project.budgetCurrency,
    extra: crm
      ? Object.fromEntries(
        LEAD_STAGES.map((stage) => [`crm-${stage}`, countsByProject.get(project.id)?.[stage] ?? 0]),
      )
      : {},
  }));

  return (
    <PerformanceTable
      tableKey="projects"
      heading={t("dashboard.project")}
      rows={rows}
      extraColumns={crm ? STAGE_COLUMNS : []}
      empty={projects.isSuccess ? t("projects.empty.title") : undefined}
      onOpen={(id) => navigate(`${projectPath(id)}${location.search}`)}
    />
  );
}
