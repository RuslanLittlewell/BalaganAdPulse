import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";
import { parseSelection, useProjects } from "@/entities/project/index.js";
import { useAuth } from "@/features/auth/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { cn, readProjectListCollapsed, useModuleMemory, writeProjectListCollapsed } from "@/shared/lib/index.js";

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
  const [collapsed, setCollapsed] = useState(readProjectListCollapsed);
  const toggle = () => {
    writeProjectListCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={cn(
        "grid overflow-hidden max-h-screen h-full min-h-0 gap-4 transition-[grid-template-columns] duration-200 motion-reduce:transition-none",
        collapsed ? "lg:grid-cols-[32px_minmax(0,1fr)]" : "lg:grid-cols-[200px_minmax(0,1fr)]",
        "lg:[&>*:last-child]:border-l lg:[&>*:last-child]:border-border lg:[&>*:last-child]:pl-6",
      )}
    >
      <ProjectList collapsed={collapsed} />
      <div className="relative min-h-0 min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? "projects.list.expand" : "projects.list.collapse")}
          className="absolute top-1/2 left-0 z-20 hidden h-12 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid"
        >
          {collapsed
            ? <ChevronRightIcon aria-hidden className="size-3" />
            : <ChevronLeftIcon aria-hidden className="size-3" />}
        </button>
        <div className="h-full min-w-0 overflow-auto pr-4">
          <Routes>
            <Route path="/" element={<ProjectsHome />} />
            <Route path=":projectId" element={<ProjectPage />} />
            <Route path=":projectId/campaigns/:campaignId" element={<CampaignPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
