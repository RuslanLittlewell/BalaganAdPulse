import { Route, Routes } from "react-router-dom";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

export function ProjectsPage() {
  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:[&>*:last-child]:border-l lg:[&>*:last-child]:border-border lg:[&>*:last-child]:pl-6">
      <ProjectList />
      <div className="min-w-0">
        <Routes>
          <Route
            path="/"
            element={
              <div
                className="flex h-full min-h-0 items-center justify-center"
                data-testid="projects-unselected"
              >
                <EmptyState
                  title={t("projects.unselected.title")}
                  description={t("projects.unselected.description")}
                />
              </div>
            }
          />
          <Route path=":projectId" element={<ProjectPage />} />
          <Route path=":projectId/campaigns/:campaignId" element={<CampaignPage />} />
        </Routes>
      </div>
    </div>
  );
}
