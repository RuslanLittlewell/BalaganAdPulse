import { useLocation, useNavigate } from "react-router-dom";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import { projectPath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/index.js";
import { LeavePreviewButton } from "./PreviewButtons.js";

export interface PreviewBarProps {
  projectId: string;
}

export function PreviewBar({ projectId }: PreviewBarProps) {
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const location = useLocation();
  const current = projects?.find((project) => project.id === projectId);
  const siblings = current
    ? (projects ?? [])
      .filter((project) => project.clientId === current.clientId)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    : [];

  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      {current ? (
        <Select value={projectId} onValueChange={(id) => navigate(`${projectPath(id)}${location.search}`)}>
          <SelectTrigger className="h-9 w-72 max-w-full" aria-label={t("preview.project")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {siblings.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <ProjectAvatar project={project} size="sm" />
                  <span className="truncate">{project.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : <span />}
      <LeavePreviewButton />
    </div>
  );
}
