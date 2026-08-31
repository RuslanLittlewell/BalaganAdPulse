import { Route, Routes } from "react-router-dom";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

/**
 * The Projects module: the project list on the left, the selected project's
 * sheets on the right. A project belongs to a client, but the client itself
 * lives in the contact book — this module is about the work.
 */
export function ProjectsPage() {
  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:[&>*:last-child]:border-l lg:[&>*:last-child]:border-border lg:[&>*:last-child]:pl-6">
      <ProjectList />
      <div className="min-w-0">
        <Routes>
          <Route
            path="/"
            element={
              <EmptyState
                title={t("projects.empty.title")}
                description={t("projects.empty.description")}
              />
            }
          />
          <Route path=":projectId" element={<ProjectPage />} />
          <Route path=":projectId/campaigns/:campaignId" element={<ProjectPage />} />
        </Routes>
      </div>
    </div>
  );
}
