import { useId } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";

export function ImportantInfo({ projectsWithoutKpi }: { projectsWithoutKpi?: readonly Project[] }) {
  const titleId = useId();
  const location = useLocation();

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-col rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">{t("dashboard.notices")}</h2>
        {projectsWithoutKpi && projectsWithoutKpi.length > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-700 dark:text-amber-300">
            <span className="sr-only">{t("dashboard.notices.noKpiCount")} </span>
            {projectsWithoutKpi.length}
          </span>
        ) : null}
      </div>

      {projectsWithoutKpi?.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
          {t("dashboard.notices.allSet")}
        </p>
      ) : null}

      {projectsWithoutKpi && projectsWithoutKpi.length > 0 ? (
        <ul className="-mx-2 mt-3 max-h-72 space-y-0.5 overflow-y-auto">
          {projectsWithoutKpi.map((project) => (
            <li key={project.id}>
              <Link
                to={`${projectPath(project.id)}${location.search}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{project.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t("dashboard.notices.noKpi")}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
