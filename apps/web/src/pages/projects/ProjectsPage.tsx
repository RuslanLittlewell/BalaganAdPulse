import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";
import { parseSelection, useProjects } from "@/entities/project/index.js";
import { useAuth } from "@/features/auth/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

function useRememberProjectPlace() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const remember = useModuleMemory((state) => state.rememberProjectPlace);

  useEffect(() => {
    if (user && parseSelection(pathname).projectId) remember(user.id, `${pathname}${search}`);
  }, [user, pathname, search, remember]);
}

function Unselected() {
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center"
      data-testid="projects-unselected"
    >
      <EmptyState
        title={t("projects.unselected.title")}
        description={t("projects.unselected.description")}
      />
    </div>
  );
}

function ProjectsHome() {
  const { user } = useAuth();
  const place = useModuleMemory((state) => (user ? state.projectPlaces[user.id] : undefined));
  const forget = useModuleMemory((state) => state.forgetProjectPlace);
  const projects = useProjects();

  const projectId = place ? parseSelection(place.split("?")[0]).projectId : undefined;
  const settled = projects.isSuccess && !projects.isFetching;
  const reachable = settled && projects.data.some((project) => project.id === projectId);

  useEffect(() => {
    if (user && place && settled && !reachable) forget(user.id);
  }, [user, place, settled, reachable, forget]);

  if (!user) return null;
  if (place && projects.isError) return <Unselected />;
  if (place && !settled) return null;
  if (place && reachable) return <Navigate to={place} replace />;
  return <Unselected />;
}

export function ProjectsPage() {
  useRememberProjectPlace();

  return (
    <div className="grid overflow-hidden max-h-screen h-full min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:[&>*:last-child]:border-l lg:[&>*:last-child]:border-border lg:[&>*:last-child]:pl-6">
      <ProjectList />
      <div className="min-w-0 overflow-auto pr-4">
        <Routes>
          <Route path="/" element={<ProjectsHome />} />
          <Route path=":projectId" element={<ProjectPage />} />
          <Route path=":projectId/campaigns/:campaignId" element={<CampaignPage />} />
        </Routes>
      </div>
    </div>
  );
}
