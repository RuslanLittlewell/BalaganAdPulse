import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Sparkline } from "@/shared/ui/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useProjects, type Project } from "@/entities/project/index.js";
import {
  EMPTY_PERFORMANCE, campaignsApi, type DateRange, type MeasuredDay, type Performance,
} from "@/entities/campaign/index.js";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";

/**
 * One request per project, twice over: its total and its shape over time.
 *
 * A single endpoint answering for every project at once would be fewer
 * requests, but it would have to decide the member's reach for all of them in
 * one query — the same rule, written a second time. Asking per project keeps
 * one answer to "may they see this".
 */
function useProjectFigures(projects: Project[], range: DateRange) {
  const summaries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["projects", project.id, "summary", { from: range.from, to: range.to }],
      queryFn: () => campaignsApi.projectSummary(project.id, range),
    })),
  });
  const series = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["projects", project.id, "daily", { from: range.from, to: range.to }],
      queryFn: () => campaignsApi.projectDaily(project.id, range),
    })),
  });
  return projects.map((project, index) => ({
    project,
    performance: (summaries[index]?.data ?? EMPTY_PERFORMANCE) as Performance,
    days: (series[index]?.data ?? []) as MeasuredDay[],
  }));
}

export function ProjectPerformanceTable({ range }: { range: DateRange }) {
  const navigate = useNavigate();
  const projects = useProjects();
  const figures = useProjectFigures(projects.data ?? [], range);

  const rows: PerformanceRow[] = figures.map(({ project, performance, days }) => ({
    id: project.id,
    name: project.name,
    note: project.niche ?? undefined,
    badge: days.length === 0 ? undefined : (
      <Sparkline
        values={days.map((day) => day.spend)}
        label={`${t("dashboard.spendByDay")}: ${project.name}`}
        className="ml-auto"
      />
    ),
    performance,
  }));

  return (
    <PerformanceTable
      heading={t("dashboard.project")}
      rows={rows}
      empty={projects.isSuccess ? t("projects.empty.title") : undefined}
      onOpen={(id) => navigate(projectPath(id))}
    />
  );
}
