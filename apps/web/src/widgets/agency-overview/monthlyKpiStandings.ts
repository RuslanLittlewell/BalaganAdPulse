import { useProjects, type Project } from "@/entities/project/index.js";
import {
  EMPTY_PERFORMANCE,
  useProjectsSummary,
  type DateRange,
  type ProjectFigures,
} from "@/entities/campaign/index.js";
import { enabledKpis } from "@/entities/kpi/index.js";
import { projectTone } from "@/widgets/project-list/projectTone.js";

export interface KpiCounts {
  met: number;
  behind: number;
  danger: number;
  unrated: number;
}

export interface KpiStandings extends KpiCounts {
  withoutKpi: Project[];
}

export function monthlyKpiStandings(
  projects: readonly Project[],
  figures: readonly ProjectFigures[],
  range: DateRange,
): KpiStandings {
  const byProject = new Map(figures.map((entry) => [entry.projectId, entry]));
  const standings: KpiStandings = { met: 0, behind: 0, danger: 0, unrated: 0, withoutKpi: [] };
  for (const project of projects) {
    if (project.kpiTracked === false) continue;
    const entry = byProject.get(project.id);
    const tone = projectTone(entry?.kpis, entry?.performance ?? EMPTY_PERFORMANCE, range);
    if (tone === "met") standings.met += 1;
    else if (tone === "none") standings.unrated += 1;
    else if (tone === "behind") standings.behind += 1;
    else standings.danger += 1;
    if (enabledKpis(entry?.kpis).length === 0) standings.withoutKpi.push(project);
  }
  return standings;
}

export function useMonthlyKpiStandings(range: DateRange): KpiStandings | undefined {
  const projects = useProjects();
  const summary = useProjectsSummary(range);
  return projects.data && summary.data
    ? monthlyKpiStandings(projects.data, summary.data, range)
    : undefined;
}
