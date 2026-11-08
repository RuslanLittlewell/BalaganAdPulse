import { useProjects, type Project } from "@/entities/project/index.js";
import {
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
  behindProjects: Project[];
  dangerProjects: Project[];
  unratedProjects: Project[];
}

export function monthlyKpiStandings(
  projects: readonly Project[],
  figures: readonly ProjectFigures[],
  range: DateRange,
): KpiStandings {
  const byProject = new Map(figures.map((entry) => [entry.projectId, entry]));
  const standings: KpiStandings = { met: 0, behind: 0, danger: 0, unrated: 0, withoutKpi: [], behindProjects: [], dangerProjects: [], unratedProjects: [] };
  for (const project of projects) {
    if (project.kpiTracked === false) continue;
    const entry = byProject.get(project.id);
    const tone = projectTone(entry, range);
    if (tone === "met") standings.met += 1;
    else if (tone === "none") {
      standings.unrated += 1;
      standings.unratedProjects.push(project);
    }
    else if (tone === "behind") {
      standings.behind += 1;
      standings.behindProjects.push(project);
    }
    else {
      standings.danger += 1;
      standings.dangerProjects.push(project);
    }
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
